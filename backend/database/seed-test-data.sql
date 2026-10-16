-- SYNTHETIC DATA ONLY. Run manually in the isolated Supabase TEST project.
-- Stable UUIDs make rerunning this seed safe; existing records are not overwritten.
begin;
select public.submit_inquiry(
  '{"idempotencyKey":"c5e6d010-c81f-4be0-9392-ac620b8649e3","name":"Test Contact","email":"contact@example.test","company":"Example Test Company","phone":"","service":"Inbox and calendar support","message":"Synthetic inquiry for calendar and meeting support.","privacyNoticeVersion":"test-seed"}'::jsonb,
  floor(extract(epoch from now()) * 1000)::bigint
);
select public.submit_privacy_request(
  '{"idempotencyKey":"9bfd7f4b-6433-4bcb-982f-b231546b0af5","name":"Test Privacy Requester","email":"privacy@example.test","requestType":"access","message":"Synthetic request for testing the owner queue."}'::jsonb,
  floor(extract(epoch from now()) * 1000)::bigint
);
commit;
