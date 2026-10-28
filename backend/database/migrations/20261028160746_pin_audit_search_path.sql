-- Fix the audit trigger's mutable search path.
alter function public.reject_audit_mutation()
  set search_path = '';