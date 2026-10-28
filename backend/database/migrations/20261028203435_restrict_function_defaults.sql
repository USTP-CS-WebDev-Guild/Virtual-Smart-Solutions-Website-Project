-- Require explicit access grants for future application functions.
begin;

-- Remove the global execution default.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;

-- Remove browser-role defaults in application schemas.
alter default privileges for role postgres
  in schema public, app_private
  revoke execute on functions from public, anon, authenticated;

commit;