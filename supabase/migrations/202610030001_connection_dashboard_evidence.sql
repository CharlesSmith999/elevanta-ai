begin;
alter table public.inbound_lead_candidates
  add column if not exists first_found_at timestamptz,
  add column if not exists first_found_by uuid references public.profiles(id);

create or replace function public.capture_research_discovery() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_previously_found boolean := false;
begin
  if tg_op='UPDATE' then
    new.first_found_at := old.first_found_at;
    new.first_found_by := old.first_found_by;
    select exists(select 1 from jsonb_array_elements(old.discovered_methods) method where public.valid_research_method_v18(method)) into v_previously_found;
  else
    new.first_found_at := null; new.first_found_by := null;
  end if;
  if new.first_found_at is null and new.duplicate_state <> 'confirmed'
    and auth.uid() is not null
    and exists(select 1 from public.profiles where id=auth.uid() and workspace_id=new.workspace_id and active and (role in ('admin','marketer') or (role='manager' and department='marketing')))
    and exists(select 1 from jsonb_array_elements(new.discovered_methods) method where public.valid_research_method_v18(method))
    and not v_previously_found then
    new.first_found_at := now(); new.first_found_by := auth.uid();
  end if;
  return new;
end; $$;
create trigger capture_research_discovery before insert or update on public.inbound_lead_candidates
for each row execute function public.capture_research_discovery();

create or replace function public.capture_activity_qualification() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_qualification text;
begin
  if new.outcome in ('connected','replied','meeting_booked') then
    select qualification::text into v_qualification from public.opportunities where id=new.opportunity_id;
    new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('qualification_at_connection',coalesce(v_qualification,'not_available'));
  end if;
  return new;
end; $$;
create trigger capture_activity_qualification before insert on public.activities
for each row execute function public.capture_activity_qualification();
revoke all on function public.capture_research_discovery(),public.capture_activity_qualification() from public,anon,authenticated;
grant select on public.inbound_lead_candidates,public.inbound_messages,public.opportunities,public.activities,public.assignments to service_role;
commit;
