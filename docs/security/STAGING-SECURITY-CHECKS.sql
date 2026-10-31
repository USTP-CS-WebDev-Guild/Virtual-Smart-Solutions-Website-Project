-- VSS 1.6.10: run in the vss-staging SQL Editor as the trusted project operator.
-- Metadata and aggregate counts only. No emails, tokens, QR seeds or records.
-- These checks inspect the current database; they do not change its policy.
-- The row-level policy definitions still require review; RLS enabled alone is
-- not proof that the policy or a provider's exposed-schema setting is correct.
begin read only;

-- Result 1: preserve enforceMfa=true. Do not disable it to fix a failed check.
select
  current_setting('server_version') as postgres_version,
  public.get_security_readiness() as security_policy;

-- Result 2: active approved accounts must bind to a verified real Auth UUID.
-- Zero unready accounts is expected; review the active role counts separately.
select
  s.role,
  count(*) as active_accounts,
  count(*) filter (
    where u.id is null
      or u.email_confirmed_at is null
      or coalesce(u.is_anonymous, false)
      or lower(trim(s.email)) is distinct from lower(trim(u.email))
  ) as unready_accounts
from public.staff_users s
left join auth.users u on u.id = s.auth_user_id
where s.active
group by s.role
order by s.role;

-- Result 3: every application table in public/app_private should have RLS.
-- Browser roles may SELECT only public.change_signals, subject to its RLS.
-- write_access below deliberately includes non-DML rights such as TRUNCATE.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select,
  has_table_privilege('anon', c.oid,
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as anon_has_write_access,
  has_table_privilege('authenticated', c.oid,
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as authenticated_has_write_access
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'app_private')
  and c.relkind in ('r', 'p')
  and not exists (
    select 1 from pg_catalog.pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
order by n.nspname, c.relname;

-- Result 4: browser roles should have no execute privilege on these server RPCs.
-- All returned public server RPCs should have security_definer=false.
-- A missing expected RPC needs migration review; an empty result is not a pass.
select
  p.proname as routine_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as argument_types,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_security_readiness', 'verify_staff_session', 'get_realtime_setup',
    'submit_inquiry', 'submit_privacy_request', 'convert_inquiry',
    'change_inquiry_status', 'change_client_status', 'add_inquiry_note',
    'complete_privacy_request', 'publish_site_content', 'get_dashboard_counts',
    'get_notification_health', 'consume_rate_limit', 'claim_outbox_batch',
    'anonymize_expired_data', 'apply_delivery_event', 'probe_realtime'
  )
order by p.proname, argument_types;

-- Result 5: this application's Realtime publication should contain change_signals,
-- not inquiry/contact/note/audit tables. Review any other rows before changing it.
select pubname, schemaname, tablename
from pg_catalog.pg_publication_tables
where pubname = 'supabase_realtime'
order by schemaname, tablename;

-- Result 6: list application views and effective browser readability.
-- At this baseline no application view is expected. If a view is introduced,
-- review its invoker behavior and grants; table RLS is not sufficient by itself.
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.relkind as view_kind,
  c.reloptions,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'app_private')
  and c.relkind in ('v', 'm')
  and not exists (
    select 1 from pg_catalog.pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
order by n.nspname, c.relname;

commit;
