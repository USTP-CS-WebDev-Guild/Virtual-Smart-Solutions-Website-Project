-- Student Studio application database (PostgreSQL / Supabase).
-- Apply this file once in Supabase Dashboard → SQL Editor.

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid unique,
  name text not null,
  email text not null,
  normalized_email text not null,
  company text,
  phone text,
  service text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','in_progress','waiting','converted','closed')),
  possible_duplicate boolean not null default false,
  privacy_notice_version text not null,
  created_at bigint not null,
  updated_at bigint not null,
  anonymized_at bigint
);
create index if not exists inquiries_status_created_idx on public.inquiries(status, created_at desc);
create index if not exists inquiries_email_created_idx on public.inquiries(normalized_email, created_at desc);

create table if not exists public.inquiry_events (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id),
  event_key text unique,
  event_type text not null,
  actor_type text not null,
  actor_id text,
  details_json jsonb not null default '{}'::jsonb,
  created_at bigint not null
);
create index if not exists inquiry_events_inquiry_created_idx on public.inquiry_events(inquiry_id, created_at desc);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  source_inquiry_id uuid not null unique references public.inquiries(id),
  contact_name text not null,
  email text not null,
  company text,
  status text not null default 'active',
  created_at bigint not null
);
create index if not exists clients_created_idx on public.clients(created_at desc);

create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id),
  message_type text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','dead')),
  delivery_status text,
  attempts integer not null default 0,
  next_attempt_at bigint not null,
  locked_until bigint,
  provider_message_id text,
  last_error text,
  created_at bigint not null,
  updated_at bigint not null,
  unique(inquiry_id, message_type)
);
create index if not exists outbox_status_next_idx on public.outbox(status, next_attempt_at);
create index if not exists outbox_provider_message_idx on public.outbox(provider_message_id);

create table if not exists public.webhook_events (
  id text primary key,
  event_type text not null,
  received_at bigint not null
);

create table if not exists public.staff_users (
  email text primary key,
  role text not null check (role in ('owner','staff')),
  active boolean not null default true,
  created_at bigint not null,
  disabled_at bigint
);

create table if not exists public.privacy_requests (
  id uuid primary key,
  name text not null,
  email text not null,
  request_type text not null check (request_type in ('access','correction','export','deletion','other')),
  message text not null,
  status text not null default 'open' check (status in ('open','completed')),
  created_at bigint not null,
  completed_at bigint,
  completed_by text,
  identity_verified_at bigint,
  completion_action text,
  completion_note text,
  anonymized_at bigint
);
create index if not exists privacy_requests_status_created_idx on public.privacy_requests(status, created_at desc);

create table if not exists public.site_content (
  id integer primary key check (id = 1),
  revision integer not null,
  content jsonb not null,
  updated_by text not null,
  updated_at bigint not null
);
create table if not exists public.site_content_events (
  id uuid primary key default gen_random_uuid(),
  revision integer not null unique,
  actor_email text not null,
  action text not null,
  before_content jsonb,
  after_content jsonb not null,
  created_at bigint not null
);
create index if not exists site_content_events_created_idx on public.site_content_events(created_at desc);

-- Stores only keyed hashes of source IPs, never raw IP addresses.
create table if not exists public.rate_limit_buckets (
  bucket_key text not null,
  window_start bigint not null,
  hit_count integer not null,
  updated_at bigint not null,
  primary key(bucket_key, window_start)
);

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_records_are_append_only';
end $$;
create trigger inquiry_events_append_only before update or delete on public.inquiry_events
  for each row execute function public.reject_audit_mutation();
create trigger site_content_events_append_only before update or delete on public.site_content_events
  for each row execute function public.reject_audit_mutation();
create trigger webhook_events_append_only before update or delete on public.webhook_events
  for each row execute function public.reject_audit_mutation();

-- The browser uses the anon key only to sign in. All application tables are
-- reachable through the checked server functions using the service role key.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'inquiries','inquiry_events','clients','outbox','webhook_events',
    'staff_users','privacy_requests','site_content','site_content_events',
    'rate_limit_buckets'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;

create or replace function public.consume_rate_limit(
  p_bucket_key text, p_window_start bigint, p_now bigint, p_limit integer
) returns boolean
language plpgsql security definer set search_path = public as $$
declare current_count integer;
begin
  insert into rate_limit_buckets(bucket_key, window_start, hit_count, updated_at)
  values (p_bucket_key, p_window_start, 1, p_now)
  on conflict(bucket_key, window_start) do update
    set hit_count = rate_limit_buckets.hit_count + 1,
        updated_at = excluded.updated_at
  returning hit_count into current_count;
  return current_count <= p_limit;
end $$;

create or replace function public.submit_inquiry(p_payload jsonb, p_now bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  inquiry_id uuid;
  duplicate_found boolean;
  email_value text;
  idem uuid := (p_payload->>'idempotencyKey')::uuid;
begin
  select id into inquiry_id from inquiries where idempotency_key = idem;
  if inquiry_id is not null then
    return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', true);
  end if;
  email_value := lower(trim(p_payload->>'email'));
  select exists(
    select 1 from inquiries
    where normalized_email = email_value and created_at >= p_now - 2592000000
      and anonymized_at is null
  ) into duplicate_found;

  insert into inquiries(
    idempotency_key,name,email,normalized_email,company,phone,service,message,
    possible_duplicate,privacy_notice_version,created_at,updated_at
  ) values (
    idem, trim(p_payload->>'name'), email_value, email_value,
    nullif(trim(coalesce(p_payload->>'company','')),''),
    nullif(trim(coalesce(p_payload->>'phone','')),''),
    trim(p_payload->>'service'), trim(p_payload->>'message'), duplicate_found,
    p_payload->>'privacyNoticeVersion', p_now, p_now
  ) on conflict(idempotency_key) do nothing returning id into inquiry_id;

  if inquiry_id is null then
    select id into inquiry_id from inquiries where idempotency_key = idem;
    return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', true);
  end if;

  insert into inquiry_events(inquiry_id,event_type,actor_type,actor_id,details_json,created_at)
  values(inquiry_id,'created','public','website-form','{}'::jsonb,p_now);
  insert into outbox(inquiry_id,message_type,status,next_attempt_at,created_at,updated_at)
  values(inquiry_id,'owner_inquiry_notice','pending',p_now,p_now,p_now);
  return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', false);
end $$;

create or replace function public.submit_privacy_request(p_payload jsonb, p_now bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare request_id uuid := (p_payload->>'idempotencyKey')::uuid;
begin
  insert into privacy_requests(id,name,email,request_type,message,status,created_at)
  values(request_id,trim(p_payload->>'name'),lower(trim(p_payload->>'email')),
    p_payload->>'requestType',trim(p_payload->>'message'),'open',p_now)
  on conflict(id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.change_inquiry_status(
  p_inquiry_id uuid, p_status text, p_actor_email text, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare old_status text;
begin
  select status into old_status from inquiries where id = p_inquiry_id for update;
  if old_status is null then return jsonb_build_object('error','not_found'); end if;
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

create or replace function public.complete_privacy_request(
  p_request_id uuid, p_actor_email text, p_action text, p_note text, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare req privacy_requests%rowtype; target record; deletion_action boolean;
begin
  select * into req from privacy_requests where id=p_request_id for update;
  if req.id is null then return jsonb_build_object('error','not_found'); end if;
  if req.status='completed' then return jsonb_build_object('error','already_completed'); end if;
  deletion_action := p_action in ('delete_all_records','delete_inquiry_records');
  if deletion_action and req.request_type <> 'deletion' then
    return jsonb_build_object('error','action_does_not_match_request');
  end if;
  if req.request_type='deletion' and not deletion_action and p_action not in ('retained_under_policy','handled_outside_system') then
    return jsonb_build_object('error','action_does_not_match_request');
  end if;

  if deletion_action then
    for target in select id from inquiries
      where normalized_email=lower(req.email) and anonymized_at is null
        and (p_action <> 'delete_inquiry_records' or status <> 'converted')
    loop
      insert into inquiry_events(inquiry_id,event_key,event_type,actor_type,actor_id,details_json,created_at)
      values(target.id,'privacy:'||p_request_id::text||':'||target.id::text,'privacy_deletion','staff',
        p_actor_email,jsonb_build_object('action','privacy deletion'),p_now)
      on conflict(event_key) do nothing;
    end loop;
    update outbox set status='dead',locked_until=null,last_error='privacy_request_fulfilled',updated_at=p_now
      where status in ('pending','sending') and inquiry_id in (
        select id from inquiries where normalized_email=lower(req.email) and anonymized_at is null
          and (p_action <> 'delete_inquiry_records' or status <> 'converted'));
    if p_action='delete_all_records' then
      update clients set contact_name='Deleted client',email='deleted+'||id::text||'@deleted.invalid',company=null
        where source_inquiry_id in (select id from inquiries where normalized_email=lower(req.email) and anonymized_at is null);
    end if;
    update inquiries set name='Deleted inquiry',email='deleted+'||id::text||'@deleted.invalid',
      normalized_email='deleted+'||id::text||'@deleted.invalid',company=null,phone=null,message='',
      idempotency_key=null,status='closed',possible_duplicate=false,anonymized_at=p_now,updated_at=p_now
      where normalized_email=lower(req.email) and anonymized_at is null
        and (p_action <> 'delete_inquiry_records' or status <> 'converted');
  end if;

  update privacy_requests set status='completed',completed_at=p_now,completed_by=p_actor_email,
    identity_verified_at=p_now,completion_action=p_action,completion_note=p_note,
    name=case when deletion_action then 'Deleted requester' else name end,
    email=case when deletion_action then 'deleted+'||id::text||'@deleted.invalid' else email end,
    message=case when deletion_action then '' else message end,
    anonymized_at=case when deletion_action then p_now else anonymized_at end
    where id=p_request_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.publish_site_content(
  p_expected_revision integer, p_content jsonb, p_actor_email text, p_now bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare current_row site_content%rowtype; next_revision integer;
begin
  perform pg_advisory_xact_lock(812904);
  select * into current_row from site_content where id=1 for update;
  if not found then
    if p_expected_revision <> 0 then return jsonb_build_object('error','content_revision_conflict'); end if;
    next_revision := 1;
    insert into site_content(id,revision,content,updated_by,updated_at)
      values(1,next_revision,p_content,p_actor_email,p_now);
    insert into site_content_events(revision,actor_email,action,before_content,after_content,created_at)
      values(next_revision,p_actor_email,'published',null,p_content,p_now);
  else
    if current_row.revision <> p_expected_revision then return jsonb_build_object('error','content_revision_conflict'); end if;
    next_revision := p_expected_revision + 1;
    update site_content set revision=next_revision,content=p_content,updated_by=p_actor_email,updated_at=p_now where id=1;
    insert into site_content_events(revision,actor_email,action,before_content,after_content,created_at)
      values(next_revision,p_actor_email,'published',current_row.content,p_content,p_now);
  end if;
  return jsonb_build_object('content',p_content,'revision',next_revision,'updatedAt',p_now);
end $$;

create or replace function public.claim_outbox_batch(p_now bigint, p_limit integer default 5)
returns setof outbox language sql security definer set search_path = public as $$
  with candidates as (
    select id from outbox
    where (status='pending' and next_attempt_at<=p_now)
       or (status='sending' and coalesce(locked_until,0)<=p_now)
    order by next_attempt_at asc
    for update skip locked limit greatest(1,least(p_limit,20))
  )
  update outbox o set status='sending',attempts=o.attempts+1,
    locked_until=p_now+120000,updated_at=p_now
  from candidates c where o.id=c.id
  returning o.*;
$$;

create or replace function public.anonymize_expired_data(p_now bigint, p_retention_ms bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inquiry_count integer; request_count integer;
begin
  update inquiries set name='Deleted inquiry',email='deleted+'||id::text||'@deleted.invalid',
    normalized_email='deleted+'||id::text||'@deleted.invalid',company=null,phone=null,message='',
    idempotency_key=null,status='closed',possible_duplicate=false,anonymized_at=p_now,updated_at=p_now
    where status<>'converted' and anonymized_at is null and updated_at < p_now-p_retention_ms;
  get diagnostics inquiry_count = row_count;
  update privacy_requests set name='Deleted requester',email='deleted+'||id::text||'@deleted.invalid',
    message='',completed_by=null,anonymized_at=p_now
    where status='completed' and anonymized_at is null and completed_at < p_now-p_retention_ms;
  get diagnostics request_count = row_count;
  delete from rate_limit_buckets where window_start < p_now-172800000;
  return jsonb_build_object('inquiriesAnonymized',inquiry_count,'requestsAnonymized',request_count);
end $$;

create or replace function public.apply_delivery_event(
  p_event_id text, p_event_type text, p_provider_message_id text, p_delivery_status text, p_now bigint
) returns boolean language plpgsql security definer set search_path = public as $$
declare inserted_id text;
begin
  insert into webhook_events(id,event_type,received_at) values(p_event_id,p_event_type,p_now)
    on conflict(id) do nothing returning id into inserted_id;
  if inserted_id is null then return false; end if;
  update outbox set delivery_status=p_delivery_status,updated_at=p_now
    where provider_message_id=p_provider_message_id;
  return true;
end $$;

-- Only trusted server code can call the transactional helpers.
create or replace function public.get_dashboard_counts()
returns jsonb language plpgsql security definer set search_path = public as $$
declare status_counts jsonb; pending_count bigint; dead_count bigint;
begin
  select coalesce(jsonb_object_agg(status, count), '{}'::jsonb) into status_counts
    from (select status, count(*)::integer as count from inquiries group by status) counts;
  select count(*) filter (where status in ('pending','sending')),
         count(*) filter (where status='dead')
    into pending_count, dead_count from outbox;
  return jsonb_build_object('inquiries',status_counts,'notifications',
    jsonb_build_object('pending',coalesce(pending_count,0),'dead',coalesce(dead_count,0)));
end $$;

create or replace function public.get_notification_health(p_now bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare dead_count bigint; oldest_open bigint;
begin
  select count(*) filter (where status='dead'), min(created_at) filter (where status in ('pending','sending'))
    into dead_count, oldest_open from outbox;
  return jsonb_build_object('status',case when coalesce(dead_count,0)>0 or
    (oldest_open is not null and oldest_open < p_now-900000) then 'attention_required' else 'ok' end);
end $$;

-- Only trusted server code can call the transactional helpers.
do $$
declare function_name text;
begin
  foreach function_name in array array[
    'consume_rate_limit(text,bigint,bigint,integer)',
    'submit_inquiry(jsonb,bigint)', 'submit_privacy_request(jsonb,bigint)',
    'change_inquiry_status(uuid,text,text,bigint)', 'convert_inquiry(uuid,text,bigint)',
    'complete_privacy_request(uuid,text,text,text,bigint)',
    'publish_site_content(integer,jsonb,text,bigint)', 'claim_outbox_batch(bigint,integer)',
    'anonymize_expired_data(bigint,bigint)',
    'apply_delivery_event(text,text,text,text,bigint)',
    'get_dashboard_counts()', 'get_notification_health(bigint)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', function_name);
    execute format('grant execute on function public.%s to service_role', function_name);
  end loop;
end $$;
