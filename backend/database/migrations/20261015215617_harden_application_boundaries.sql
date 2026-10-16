-- Additive security upgrade. Run after all earlier migrations.
-- NOT VALID preserves legacy rows; new writes are checked immediately.
begin;

-- No browser role needs to create objects in the application's search path.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to service_role;

alter table public.inquiries add constraint inquiries_field_bounds check (
  char_length(name)<=120 and char_length(email)<=254 and char_length(normalized_email)<=254
  and char_length(coalesce(company,''))<=160 and char_length(coalesce(phone,''))<=40
  and char_length(service)<=120 and char_length(message)<=5000
  and char_length(privacy_notice_version)<=120
) not valid;
alter table public.clients add constraint clients_field_bounds check (
  char_length(contact_name)<=120 and char_length(email)<=254
  and char_length(coalesce(company,''))<=160 and status in ('active','paused','closed')
) not valid;
alter table public.privacy_requests add constraint privacy_field_bounds check (
  char_length(name)<=120 and char_length(email)<=254 and char_length(message)<=2000
  and char_length(coalesce(completion_note,''))<=1000
) not valid;
alter table public.staff_users add constraint staff_email_bounds check (
  char_length(email) between 3 and 254 and email=lower(trim(email))
) not valid;
alter table public.webhook_events add constraint webhook_field_bounds check (
  char_length(id) between 1 and 200 and char_length(event_type) between 1 and 80
) not valid;
alter table public.outbox add constraint outbox_field_bounds check (
  attempts>=0 and char_length(coalesce(provider_message_id,''))<=200
  and char_length(coalesce(last_error,''))<=200
) not valid;

create or replace function public.consume_rate_limit(
  p_bucket_key text, p_window_start bigint, p_now bigint, p_limit integer
) returns boolean language plpgsql security invoker set search_path='' as $$
declare current_count integer;
begin
  if p_limit is null or p_limit<1 or p_limit>1000 or
     p_bucket_key is null or char_length(p_bucket_key) not between 1 and 200 then
    raise exception 'invalid_rate_limit_parameters';
  end if;
  insert into public.rate_limit_buckets(bucket_key,window_start,hit_count,updated_at)
  values(p_bucket_key,p_window_start,1,p_now)
  on conflict(bucket_key,window_start) do update
    set hit_count=least(public.rate_limit_buckets.hit_count::bigint+1,p_limit+1)::integer,
        updated_at=excluded.updated_at
  returning hit_count into current_count;
  return current_count<=p_limit;
end $$;

-- Expired leases also obey the attempt ceiling if a worker died mid-send.
create or replace function public.claim_outbox_batch(p_now bigint,p_limit integer default 5)
returns setof public.outbox language plpgsql security invoker set search_path='' as $$
begin
  update public.outbox set status='dead',locked_until=null,
    last_error='retry_limit_reached',updated_at=p_now
  where attempts>=8 and (
    (status='pending' and next_attempt_at<=p_now) or
    (status='sending' and coalesce(locked_until,0)<=p_now)
  );
  return query
  with candidates as (
    select id from public.outbox where attempts<8 and (
      (status='pending' and next_attempt_at<=p_now) or
      (status='sending' and coalesce(locked_until,0)<=p_now)
    ) order by next_attempt_at asc
    for update skip locked limit greatest(1,least(p_limit,20))
  )
  update public.outbox o set status='sending',attempts=o.attempts+1,
    locked_until=p_now+120000,updated_at=p_now
  from candidates c where o.id=c.id returning o.*;
end $$;

-- Legacy helpers need table access from the server, not database-owner power.
-- public is trusted here: CREATE was revoked above. New helpers use qualified names.
do $$
declare fn text;
begin
  foreach fn in array array[
    'submit_privacy_request(jsonb,bigint)',
    'change_inquiry_status(uuid,text,text,bigint)','convert_inquiry(uuid,text,bigint)',
    'complete_privacy_request(uuid,text,text,text,bigint)',
    'publish_site_content(integer,jsonb,text,bigint)',
    'anonymize_expired_data(bigint,bigint)',
    'apply_delivery_event(text,text,text,text,bigint)',
    'get_dashboard_counts()','get_notification_health(bigint)'
  ] loop
    execute format('alter function public.%s security invoker',fn);
    execute format('alter function public.%s set search_path=pg_catalog,public',fn);
  end loop;
  foreach fn in array array[
    'consume_rate_limit(text,bigint,bigint,integer)',
    'claim_outbox_batch(bigint,integer)'
  ] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',fn);
    execute format('grant execute on function public.%s to service_role',fn);
  end loop;
end $$;
commit;
