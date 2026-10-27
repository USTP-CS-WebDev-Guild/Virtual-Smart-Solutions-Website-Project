-- RUN ONLY IN THE CLIENT PRODUCTION DATABASE AFTER THE NEW MIGRATION.
-- First confirm every approved staff row is bound to the correct Auth user ID.
-- The next owner sign-in will require authenticator enrollment or a valid code.
begin;
do $$ begin
  if not exists(select 1 from public.staff_users where role='owner' and active and auth_user_id is not null) then
    raise exception 'Create and bind the verified production owner first';
  end if;
  if exists(select 1 from public.staff_users where active and auth_user_id is null) then
    raise exception 'Review and bind or disable unlinked staff accounts first';
  end if;
end $$;
update app_private.security_settings set enforce_mfa=true where singleton;
commit;
select public.get_security_readiness();
