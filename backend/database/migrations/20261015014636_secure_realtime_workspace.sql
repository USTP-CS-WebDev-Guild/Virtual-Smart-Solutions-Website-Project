-- Apply AFTER 0001 to the same project. This migration does not seed contacts,
-- change passwords, or expose business records to browser roles.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.has_staff_access(p_owner_only boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.staff_users s
    join auth.users u on lower(trim(u.email))=s.email
    where u.id=(select auth.uid()) and s.active
      and (not p_owner_only or s.role='owner')
  );
$$;
revoke all on function app_private.has_staff_access(boolean) from public, anon, authenticated, service_role;
grant execute on function app_private.has_staff_access(boolean) to authenticated;

-- The only application data streamed to browsers is these three version rows.
-- No names, messages, emails, note text, or private content snapshots are here.
create table if not exists public.change_signals (
  scope text primary key check(scope in ('public','staff','owner')),
  revision bigint not null default 0,
  changed_at bigint not null default 0
);
insert into public.change_signals(scope) values('public'),('staff'),('owner') on conflict do nothing;
alter table public.change_signals enable row level security;
revoke all on public.change_signals from public, anon, authenticated;
grant select on public.change_signals to anon, authenticated;
grant all on public.change_signals to service_role;
drop policy if exists public_site_signal on public.change_signals;
create policy public_site_signal on public.change_signals for select to anon using(scope='public');
drop policy if exists approved_staff_signals on public.change_signals;
create policy approved_staff_signals on public.change_signals for select to authenticated using(
  scope='public'
  or (scope='staff' and (select app_private.has_staff_access(false)))
  or (scope='owner' and (select app_private.has_staff_access(true)))
);

create table if not exists public.inquiry_notes (
  id uuid primary key,
  inquiry_id uuid not null references public.inquiries(id),
  body text not null,
  created_by text,
  created_at bigint not null,
  anonymized_at bigint,
  check(anonymized_at is not null or length(trim(body)) between 2 and 2000)
);
create index if not exists inquiry_notes_inquiry_created_idx on public.inquiry_notes(inquiry_id,created_at desc);
alter table public.inquiry_notes enable row level security;
revoke all on public.inquiry_notes from public, anon, authenticated;
grant all on public.inquiry_notes to service_role;

create or replace function app_private.emit_change_signal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.change_signals set revision=revision+1,
    changed_at=floor(extract(epoch from clock_timestamp())*1000)::bigint
    where scope=any(string_to_array(tg_argv[0],','));
  return null;
end $$;
revoke all on function app_private.emit_change_signal() from public, anon, authenticated, service_role;

drop trigger if exists inquiries_live_change on public.inquiries;
create trigger inquiries_live_change after insert or update or delete on public.inquiries
for each row execute function app_private.emit_change_signal('staff');
drop trigger if exists inquiry_events_live_change on public.inquiry_events;
create trigger inquiry_events_live_change after insert on public.inquiry_events
for each row execute function app_private.emit_change_signal('staff');
drop trigger if exists notes_live_change on public.inquiry_notes;
create trigger notes_live_change after insert or update or delete on public.inquiry_notes
for each row execute function app_private.emit_change_signal('staff');
drop trigger if exists clients_live_change on public.clients;
create trigger clients_live_change after insert or update or delete on public.clients
for each row execute function app_private.emit_change_signal('staff');
drop trigger if exists outbox_live_change on public.outbox;
create trigger outbox_live_change after insert or update or delete on public.outbox
for each row execute function app_private.emit_change_signal('staff');
drop trigger if exists privacy_live_change on public.privacy_requests;
create trigger privacy_live_change after insert or update or delete on public.privacy_requests
for each row execute function app_private.emit_change_signal('owner');
drop trigger if exists site_live_change on public.site_content;
create trigger site_live_change after insert or update or delete on public.site_content
for each row execute function app_private.emit_change_signal('public');

-- Existing deletion and retention RPCs anonymize the parent inquiry. Notes
-- follow the same transaction so a new notes feature cannot retain that PII.
create or replace function app_private.anonymize_inquiry_notes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.anonymized_at is not null and old.anonymized_at is null then
    update public.inquiry_notes set body='',created_by=null,anonymized_at=new.anonymized_at
      where inquiry_id=new.id and anonymized_at is null;
  end if;
  return null;
end $$;
revoke all on function app_private.anonymize_inquiry_notes() from public, anon, authenticated, service_role;
drop trigger if exists inquiries_note_cleanup on public.inquiries;
create trigger inquiries_note_cleanup after update of anonymized_at on public.inquiries
for each row execute function app_private.anonymize_inquiry_notes();

create or replace function public.add_inquiry_note(
  p_id uuid,p_inquiry_id uuid,p_body text,p_actor_email text,p_now bigint
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare target public.inquiries%rowtype; existing public.inquiry_notes%rowtype;
begin
  select * into target from public.inquiries where id=p_inquiry_id for update;
  if target.id is null then return jsonb_build_object('error','not_found'); end if;
  if target.anonymized_at is not null then return jsonb_build_object('error','record_anonymized'); end if;
  if length(trim(p_body)) not between 2 and 2000 then return jsonb_build_object('error','invalid_note'); end if;
  select * into existing from public.inquiry_notes where id=p_id;
  if existing.id is not null then
    if existing.inquiry_id<>p_inquiry_id then return jsonb_build_object('error','note_key_conflict'); end if;
    return jsonb_build_object('ok',true,'noteId',existing.id,'repeated',true);
  end if;
  insert into public.inquiry_notes(id,inquiry_id,body,created_by,created_at)
    values(p_id,p_inquiry_id,trim(p_body),p_actor_email,p_now);
  insert into public.inquiry_events(inquiry_id,event_type,actor_type,actor_id,details_json,created_at)
    values(p_inquiry_id,'note_added','staff',p_actor_email,jsonb_build_object('noteId',p_id),p_now);
  update public.inquiries set updated_at=p_now where id=p_inquiry_id;
  return jsonb_build_object('ok',true,'noteId',p_id,'repeated',false);
end $$;
revoke all on function public.add_inquiry_note(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.add_inquiry_note(uuid,uuid,text,text,bigint) to service_role;

create or replace function public.change_client_status(p_client_id uuid,p_status text,p_actor_email text,p_now bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare target public.clients%rowtype; archived bigint;
begin
  if p_status not in ('active','paused','closed') then return jsonb_build_object('error','invalid_status'); end if;
  select * into target from public.clients where id=p_client_id for update;
  if target.id is null then return jsonb_build_object('error','not_found'); end if;
  select anonymized_at into archived from public.inquiries where id=target.source_inquiry_id for update;
  if archived is not null then return jsonb_build_object('error','record_anonymized'); end if;
  if target.status<>p_status then
    update public.clients set status=p_status where id=p_client_id;
    insert into public.inquiry_events(inquiry_id,event_type,actor_type,actor_id,details_json,created_at)
      values(target.source_inquiry_id,'client_status_changed','staff',p_actor_email,
        jsonb_build_object('clientId',p_client_id,'from',target.status,'to',p_status),p_now);
  end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.change_client_status(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.change_client_status(uuid,text,text,bigint) to service_role;

-- Never drop an existing publication or add private business tables to it.
do $$ begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='change_signals') then
    alter publication supabase_realtime add table public.change_signals;
  end if;
end $$;

create or replace function public.get_realtime_setup()
returns jsonb language sql security invoker set search_path = '' as $$
  select jsonb_build_object(
    'publication',exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='change_signals'),
    'signals',(select count(*)=3 from public.change_signals),
    'triggers',(select count(*)=7 from pg_catalog.pg_trigger where not tgisinternal and tgenabled<>'D'
      and tgname in ('inquiries_live_change','inquiry_events_live_change','notes_live_change',
        'clients_live_change','outbox_live_change','privacy_live_change','site_live_change')),
    'rls',coalesce((select relrowsecurity from pg_catalog.pg_class where oid='public.change_signals'::regclass),false)
  );
$$;
revoke all on function public.get_realtime_setup() from public,anon,authenticated;
grant execute on function public.get_realtime_setup() to service_role;
-- Deleted records cannot be reopened or converted by a stale browser tab.
create or replace function public.change_inquiry_status(
  p_inquiry_id uuid, p_status text, p_actor_email text, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare old_status text; archived bigint;
begin
  select status,anonymized_at into old_status,archived from inquiries where id = p_inquiry_id for update;
  if old_status is null then return jsonb_build_object('error','not_found'); end if;
  if archived is not null then return jsonb_build_object('error','record_anonymized'); end if;
  if old_status = 'converted' then return jsonb_build_object('error','converted_inquiry_is_locked'); end if;
  update inquiries set status=p_status, updated_at=p_now where id=p_inquiry_id;
  insert into inquiry_events(inquiry_id,event_type,actor_type,actor_id,details_json,created_at)
    values(p_inquiry_id,'status_changed','staff',p_actor_email,
      jsonb_build_object('from',old_status,'to',p_status),p_now);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.convert_inquiry(
  p_inquiry_id uuid, p_actor_email text, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare inquiry_row inquiries%rowtype; client_row clients%rowtype;
begin
  select * into inquiry_row from inquiries where id=p_inquiry_id for update;
  if inquiry_row.id is null then return jsonb_build_object('error','not_found'); end if;
  if inquiry_row.anonymized_at is not null then return jsonb_build_object('error','record_anonymized'); end if;
  select * into client_row from clients where source_inquiry_id=p_inquiry_id;
  if client_row.id is null then
    insert into clients(source_inquiry_id,contact_name,email,company,status,created_at)
      values(p_inquiry_id,inquiry_row.name,inquiry_row.email,inquiry_row.company,'active',p_now)
      returning * into client_row;
    update inquiries set status='converted',updated_at=p_now where id=p_inquiry_id;
    insert into inquiry_events(inquiry_id,event_key,event_type,actor_type,actor_id,details_json,created_at)
      values(p_inquiry_id,'convert:'||p_inquiry_id::text,'converted_to_client','staff',p_actor_email,
        jsonb_build_object('clientId',client_row.id),p_now) on conflict(event_key) do nothing;
  end if;
  return jsonb_build_object('ok',true,'client',jsonb_build_object(
    'id',client_row.id,'source_inquiry_id',client_row.source_inquiry_id,
    'contact_name',client_row.contact_name,'email',client_row.email,
    'company',client_row.company,'status',client_row.status,'created_at',client_row.created_at));
end $$;


create or replace function public.probe_realtime()
returns jsonb language sql security invoker set search_path = '' as $$
  update public.change_signals set revision=revision+1,
    changed_at=floor(extract(epoch from clock_timestamp())*1000)::bigint
  where scope='staff' returning jsonb_build_object('revision',revision);
$$;
revoke all on function public.probe_realtime() from public,anon,authenticated;
grant execute on function public.probe_realtime() to service_role;
commit;
