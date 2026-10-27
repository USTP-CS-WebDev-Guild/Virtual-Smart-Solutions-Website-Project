-- Additive upgrade. Does not reset records or change account passwords.
-- Staging stays usable; SECURE-PRODUCTION.sql explicitly arms production MFA.
begin;
alter table public.staff_users add column auth_user_id uuid
  unique references auth.users(id) on delete set null;
update public.staff_users s set auth_user_id=u.id from auth.users u
where lower(trim(u.email))=s.email and u.email_confirmed_at is not null
  and not coalesce(u.is_anonymous,false)
  and (select count(*) from auth.users candidate where lower(trim(candidate.email))=s.email
    and candidate.email_confirmed_at is not null and not coalesce(candidate.is_anonymous,false))=1;

-- Bind only an explicit new staff approval. A deleted/re-created Auth account
-- must not inherit an existing staff row just by reusing its email address.
create or replace function app_private.bind_staff_identity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.auth_user_id is null then
    select u.id into new.auth_user_id from auth.users u
    where lower(trim(u.email))=new.email and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false)
      and (select count(*) from auth.users candidate where lower(trim(candidate.email))=new.email
        and candidate.email_confirmed_at is not null and not coalesce(candidate.is_anonymous,false))=1;
  end if;
  return new;
end $$;
revoke all on function app_private.bind_staff_identity() from public,anon,authenticated,service_role;
create trigger staff_identity_on_approval before insert on public.staff_users
for each row execute function app_private.bind_staff_identity();

create table app_private.security_settings (
  singleton boolean primary key default true check(singleton),
  enforce_mfa boolean not null default false
);
insert into app_private.security_settings(singleton,enforce_mfa) values(true,false);
create table app_private.staff_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null
);
alter table app_private.security_settings enable row level security;
alter table app_private.staff_sessions enable row level security;
revoke all on app_private.security_settings,app_private.staff_sessions from public,anon,authenticated;
grant all on app_private.security_settings,app_private.staff_sessions to service_role;

create or replace function app_private.verify_staff_session(
  p_user_id uuid,p_session_id uuid,p_aal text,p_now bigint
) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_time_value timestamptz := to_timestamp(p_now/1000.0);
  accepted uuid;
begin
  if not (select enforce_mfa from app_private.security_settings where singleton) then
    return jsonb_build_object('ok',false,'error','security_configuration_required');
  end if;
  if p_aal is distinct from 'aal2' or not exists(
    select 1 from public.staff_users s join auth.users u on u.id=s.auth_user_id
    join auth.sessions session on session.user_id=u.id
    where u.id=p_user_id and session.id=p_session_id and s.active
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and session.created_at > current_time_value - interval '8 hours'
      and (session.not_after is null or session.not_after>current_time_value)
  ) then return jsonb_build_object('ok',false,'error','staff_access_required'); end if;
  insert into app_private.staff_sessions(session_id,user_id,last_seen)
  values(p_session_id,p_user_id,current_time_value)
  on conflict(session_id) do update set last_seen=excluded.last_seen
    where app_private.staff_sessions.user_id=p_user_id
      and app_private.staff_sessions.last_seen>current_time_value-interval '15 minutes'
  returning session_id into accepted;
  return jsonb_build_object('ok',accepted is not null);
end $$;
revoke all on function app_private.verify_staff_session(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function app_private.verify_staff_session(uuid,uuid,text,bigint) to service_role;
create or replace function public.verify_staff_session(
  p_user_id uuid,p_session_id uuid,p_aal text,p_now bigint
) returns jsonb language sql security invoker set search_path='' as $$
  select app_private.verify_staff_session(p_user_id,p_session_id,p_aal,p_now)
$$;
revoke all on function public.verify_staff_session(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.verify_staff_session(uuid,uuid,text,bigint) to service_role;

create or replace function public.get_security_readiness()
returns jsonb language sql security invoker set search_path='' as $$
  select jsonb_build_object('enforceMfa',enforce_mfa)
  from app_private.security_settings where singleton
$$;
revoke all on function public.get_security_readiness() from public,anon,authenticated;
grant execute on function public.get_security_readiness() to service_role;

-- A browser cannot bypass the API's MFA/session policy through Realtime/REST.
create or replace function app_private.has_staff_access(p_owner_only boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.staff_users s join auth.users u on u.id=s.auth_user_id
    where u.id=(select auth.uid()) and s.active
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
      and (not p_owner_only or s.role='owner')
  ) and (
    not (select enforce_mfa from app_private.security_settings where singleton)
    or (
      (select auth.jwt()->>'aal')='aal2' and exists(
        select 1 from auth.sessions session
        join app_private.staff_sessions activity on activity.session_id=session.id
        where session.id::text=(select auth.jwt()->>'session_id')
          and session.user_id=(select auth.uid())
          and activity.user_id=(select auth.uid())
          and session.created_at>now()-interval '8 hours'
          and (session.not_after is null or session.not_after>now())
          and activity.last_seen>now()-interval '15 minutes'
      )
    )
  )
$$;
revoke all on function app_private.has_staff_access(boolean) from public,anon,authenticated,service_role;
grant execute on function app_private.has_staff_access(boolean) to authenticated;

-- New helper functions must not regain default PUBLIC execution rights.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema app_private revoke execute on functions from public;
commit;
