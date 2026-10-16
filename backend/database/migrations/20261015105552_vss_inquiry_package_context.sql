-- VSS package context. Additive upgrade; preserves existing records and grants.
begin;
alter table public.inquiries add column if not exists requested_plan jsonb
  check(requested_plan is null or (jsonb_typeof(requested_plan)='object' and pg_column_size(requested_plan)<=2048));

create or replace function public.submit_inquiry(p_payload jsonb, p_now bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  inquiry_id uuid;
  duplicate_found boolean;
  email_value text;
  idem uuid := (p_payload->>'idempotencyKey')::uuid;
begin
  select id into inquiry_id from public.inquiries where idempotency_key = idem;
  if inquiry_id is not null then
    return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', true);
  end if;
  email_value := lower(trim(p_payload->>'email'));
  select exists(
    select 1 from public.inquiries
    where normalized_email = email_value and created_at >= p_now - 2592000000
      and anonymized_at is null
  ) into duplicate_found;

  insert into public.inquiries(
    idempotency_key,name,email,normalized_email,company,phone,service,message,
    possible_duplicate,privacy_notice_version,created_at,updated_at,requested_plan
  ) values (
    idem, trim(p_payload->>'name'), email_value, email_value,
    nullif(trim(coalesce(p_payload->>'company','')),''),
    nullif(trim(coalesce(p_payload->>'phone','')),''),
    trim(p_payload->>'service'), trim(p_payload->>'message'), duplicate_found,
    p_payload->>'privacyNoticeVersion', p_now, p_now, nullif(p_payload->'requestedPlan','null'::jsonb)
  ) on conflict(idempotency_key) do nothing returning id into inquiry_id;

  if inquiry_id is null then
    select id into inquiry_id from public.inquiries where idempotency_key = idem;
    return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', true);
  end if;

  insert into public.inquiry_events(inquiry_id,event_type,actor_type,actor_id,details_json,created_at)
  values(inquiry_id,'created','public','website-form',jsonb_build_object('requestedPlan',nullif(p_payload->'requestedPlan','null'::jsonb)),p_now);
  insert into public.outbox(inquiry_id,message_type,status,next_attempt_at,created_at,updated_at)
  values(inquiry_id,'owner_inquiry_notice','pending',p_now,p_now,p_now);
  return jsonb_build_object('ok', true, 'inquiryId', inquiry_id, 'repeated', false);
end $$;


revoke all on function public.submit_inquiry(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.submit_inquiry(jsonb,bigint) to service_role;

-- Anonymization also clears any package context stored on the contact.
create or replace function app_private.clear_anonymized_package()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.anonymized_at is not null then new.requested_plan := null; end if;
  return new;
end $$;
revoke all on function app_private.clear_anonymized_package() from public,anon,authenticated,service_role;
drop trigger if exists clear_anonymized_package on public.inquiries;
create trigger clear_anonymized_package before update on public.inquiries
  for each row execute function app_private.clear_anonymized_package();
commit;
