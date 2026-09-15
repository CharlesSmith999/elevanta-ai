-- Admin user-management service-role grants.
-- This repairs the live failure where the server-only service role can call
-- Supabase Auth but lacks the narrow public-table privileges used by the
-- Admin user-management endpoints. It does not grant anything to anon or
-- authenticated, and it does not disable RLS.

grant usage on schema public to service_role;

grant select, insert, update on table public.profiles to service_role;
grant select on table public.assignments to service_role;
grant insert on table public.audit_events to service_role;
