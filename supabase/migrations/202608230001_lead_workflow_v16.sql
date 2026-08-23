-- Lead workflow v1.6: immediate handoff, contact-method quality, and durable activity history.
-- This migration is additive. It does not import production lead data.

do $$ begin
  create type public.contact_method_type as enum ('phone', 'email');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contact_method_health as enum ('unverified', 'verified', 'incorrect', 'wrong_person', 'reception_gatekeeper', 'do_not_contact');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.contact_method_focus as enum ('active', 'secondary', 'removed');
exception when duplicate_object then null; end $$;

create table if not exists public.contact_methods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  method_type public.contact_method_type not null,
  value text not null,
  normalized_value text not null,
  label text,
  globally_restricted boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, method_type, normalized_value)
);
create index if not exists contact_methods_contact_idx on public.contact_methods(contact_id);

create table if not exists public.opportunity_contact_methods (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_method_id uuid not null references public.contact_methods(id) on delete cascade,
  health public.contact_method_health not null default 'unverified',
  focus public.contact_method_focus not null default 'active',
  assessment_reason text,
  last_assessed_by uuid references public.profiles(id),
  last_assessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, contact_method_id)
);
create index if not exists opportunity_contact_methods_opportunity_idx on public.opportunity_contact_methods(opportunity_id, focus);

create table if not exists public.contact_method_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  contact_method_id uuid not null references public.contact_methods(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('added','assessed','removed','restored','reassignment_decision')),
  from_health public.contact_method_health,
  to_health public.contact_method_health,
  from_focus public.contact_method_focus,
  to_focus public.contact_method_focus,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists contact_method_events_opportunity_idx on public.contact_method_events(opportunity_id, created_at desc);

create table if not exists public.assignment_contact_method_decisions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  contact_method_id uuid not null references public.contact_methods(id) on delete cascade,
  decision text not null check (decision in ('keep_active','keep_secondary','keep_removed','restored')),
  reason text,
  decided_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.activities
  add column if not exists assignment_id uuid references public.assignments(id) on delete set null,
  add column if not exists contact_method_id uuid references public.contact_methods(id) on delete set null,
  add column if not exists outcome text,
  add column if not exists occurred_at timestamptz;
update public.activities set occurred_at = created_at where occurred_at is null;
alter table public.activities alter column occurred_at set default now();
alter table public.follow_ups
  add column if not exists contact_method_id uuid references public.contact_methods(id) on delete set null,
  add column if not exists purpose text,
  add column if not exists timezone text,
  add column if not exists cancellation_reason text;

-- Backfill the original single contact fields as canonical contact methods and connect them to every opportunity.
insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_at, updated_at)
select workspace_id, id, 'phone', normalized_phone, normalized_phone, created_at, updated_at
from public.contacts where normalized_phone is not null
on conflict (workspace_id, method_type, normalized_value) do nothing;
insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_at, updated_at)
select workspace_id, id, 'email', normalized_email, normalized_email, created_at, updated_at
from public.contacts where normalized_email is not null
on conflict (workspace_id, method_type, normalized_value) do nothing;
insert into public.opportunity_contact_methods(opportunity_id, contact_method_id)
select o.id, cm.id from public.opportunities o join public.contact_methods cm on cm.contact_id = o.contact_id
on conflict (opportunity_id, contact_method_id) do nothing;

-- Keep future CRM-created opportunities consistent with the backfilled records.
-- A lead created through the normal opportunity flow immediately receives contact methods.
create or replace function public.seed_opportunity_contact_methods() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value)
  select c.workspace_id, c.id, 'phone', c.normalized_phone, c.normalized_phone
  from public.contacts c where c.id = new.contact_id and c.normalized_phone is not null
  on conflict (workspace_id, method_type, normalized_value) do nothing;
  insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value)
  select c.workspace_id, c.id, 'email', c.normalized_email, c.normalized_email
  from public.contacts c where c.id = new.contact_id and c.normalized_email is not null
  on conflict (workspace_id, method_type, normalized_value) do nothing;
  insert into public.opportunity_contact_methods(opportunity_id, contact_method_id)
  select new.id, cm.id from public.contact_methods cm where cm.contact_id = new.contact_id
  on conflict (opportunity_id, contact_method_id) do nothing;
  return new;
end;
$$;
drop trigger if exists opportunities_seed_contact_methods on public.opportunities;
create trigger opportunities_seed_contact_methods
after insert on public.opportunities for each row execute function public.seed_opportunity_contact_methods();

alter table public.contact_methods enable row level security;
alter table public.opportunity_contact_methods enable row level security;
alter table public.contact_method_events enable row level security;
alter table public.assignment_contact_method_decisions enable row level security;
create policy "contact methods follow visible opportunities" on public.contact_methods for select using (
  workspace_id = public.current_workspace_id() and exists (select 1 from public.opportunities o where o.contact_id = contact_methods.contact_id and public.can_access_opportunity(o.id))
);
create policy "opportunity methods follow opportunity scope" on public.opportunity_contact_methods for select using (public.can_access_opportunity(opportunity_id));
create policy "contact method events follow opportunity scope" on public.contact_method_events for select using (public.can_access_opportunity(opportunity_id));
create policy "assignment method decisions follow opportunity scope" on public.assignment_contact_method_decisions for select using (exists (select 1 from public.assignments a where a.id = assignment_id and public.can_access_opportunity(a.opportunity_id)));

create or replace function public.current_assignment_id(p_opportunity_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select id from public.assignments where opportunity_id = p_opportunity_id and ended_at is null
$$;

create or replace function public.can_manage_contact_quality(p_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin'
    or (public.current_role() = 'manager' and public.can_access_opportunity(p_opportunity_id))
    or exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null)
    or (public.current_role() = 'marketer' and exists(select 1 from public.opportunities where id = p_opportunity_id and marketing_owner_id = auth.uid()))
$$;

create or replace function public.add_opportunity_contact_method(
  p_opportunity_id uuid, p_method_type public.contact_method_type, p_value text, p_label text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_opportunity public.opportunities; v_normalized text; v_method uuid;
begin
  select * into v_opportunity from public.opportunities where id = p_opportunity_id;
  if v_opportunity.id is null or not public.can_manage_contact_quality(p_opportunity_id) then raise exception 'Not permitted'; end if;
  v_normalized := case when p_method_type = 'phone' then nullif(regexp_replace(coalesce(p_value,''), '\\D','','g'),'') else nullif(lower(trim(coalesce(p_value,''))),'') end;
  if v_normalized is null or (p_method_type = 'email' and v_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') then raise exception 'Provide a valid %', p_method_type; end if;
  insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, label, created_by)
  values(v_opportunity.workspace_id, v_opportunity.contact_id, p_method_type, trim(p_value), v_normalized, nullif(trim(p_label),''), auth.uid())
  on conflict (workspace_id, method_type, normalized_value) do update set updated_at = now()
  returning id into v_method;
  insert into public.opportunity_contact_methods(opportunity_id, contact_method_id) values(p_opportunity_id, v_method) on conflict do nothing;
  insert into public.contact_method_events(workspace_id, opportunity_id, assignment_id, contact_method_id, actor_id, event_type, to_health, to_focus)
  values(v_opportunity.workspace_id, p_opportunity_id, public.current_assignment_id(p_opportunity_id), v_method, auth.uid(), 'added', 'unverified', 'active');
  return v_method;
end;
$$;

create or replace function public.assess_opportunity_contact_method(
  p_opportunity_id uuid, p_contact_method_id uuid, p_health public.contact_method_health, p_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_item_id uuid; v_old_health public.contact_method_health; v_old_focus public.contact_method_focus; v_focus public.contact_method_focus; v_workspace uuid;
begin
  if not public.can_manage_contact_quality(p_opportunity_id) then raise exception 'Not permitted'; end if;
  select ocm.id, ocm.health, ocm.focus, o.workspace_id into v_item_id, v_old_health, v_old_focus, v_workspace from public.opportunity_contact_methods ocm join public.opportunities o on o.id = ocm.opportunity_id where ocm.opportunity_id = p_opportunity_id and ocm.contact_method_id = p_contact_method_id for update;
  if v_item_id is null then raise exception 'Contact method does not belong to this lead'; end if;
  v_focus := case when p_health in ('incorrect','wrong_person','do_not_contact') then 'removed' when p_health = 'reception_gatekeeper' then 'secondary' else 'active' end;
  update public.opportunity_contact_methods set health = p_health, focus = v_focus, assessment_reason = nullif(trim(p_reason),''), last_assessed_by = auth.uid(), last_assessed_at = now(), updated_at = now() where id = v_item_id;
  if p_health = 'do_not_contact' then update public.contact_methods set globally_restricted = true, updated_at = now() where id = p_contact_method_id; end if;
  insert into public.contact_method_events(workspace_id, opportunity_id, assignment_id, contact_method_id, actor_id, event_type, from_health, to_health, from_focus, to_focus, reason)
  values(v_workspace, p_opportunity_id, public.current_assignment_id(p_opportunity_id), p_contact_method_id, auth.uid(), case when v_focus = 'removed' then 'removed' else 'assessed' end, v_old_health, p_health, v_old_focus, v_focus, nullif(trim(p_reason),''));
end;
$$;

create or replace function public.restore_opportunity_contact_method(p_opportunity_id uuid, p_contact_method_id uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_item_id uuid; v_old_health public.contact_method_health; v_old_focus public.contact_method_focus; v_workspace uuid; v_restricted boolean;
begin
  select ocm.id, ocm.health, ocm.focus, o.workspace_id, cm.globally_restricted into v_item_id, v_old_health, v_old_focus, v_workspace, v_restricted from public.opportunity_contact_methods ocm join public.opportunities o on o.id = ocm.opportunity_id join public.contact_methods cm on cm.id = ocm.contact_method_id where ocm.opportunity_id = p_opportunity_id and ocm.contact_method_id = p_contact_method_id for update;
  if v_item_id is null then raise exception 'Contact method does not belong to this lead'; end if;
  if public.current_role() not in ('admin','manager','marketer') then raise exception 'Only Lead Gen, Manager, or Admin can restore a removed contact'; end if;
  if public.current_role() = 'marketer' and not exists(select 1 from public.opportunities where id = p_opportunity_id and marketing_owner_id = auth.uid()) then raise exception 'Not permitted'; end if;
  if v_restricted and public.current_role() not in ('admin','manager') then raise exception 'Do Not Contact can only be restored by a Manager or Admin'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'A restoration reason is required'; end if;
  update public.opportunity_contact_methods set health = 'unverified', focus = 'active', assessment_reason = trim(p_reason), last_assessed_by = auth.uid(), last_assessed_at = now(), updated_at = now() where id = v_item_id;
  if v_restricted then update public.contact_methods set globally_restricted = false, updated_at = now() where id = p_contact_method_id; end if;
  insert into public.contact_method_events(workspace_id, opportunity_id, assignment_id, contact_method_id, actor_id, event_type, from_health, to_health, from_focus, to_focus, reason)
  values(v_workspace, p_opportunity_id, public.current_assignment_id(p_opportunity_id), p_contact_method_id, auth.uid(), 'restored', v_old_health, 'unverified', v_old_focus, 'active', trim(p_reason));
end;
$$;

create or replace function public.log_sales_activity(
  p_opportunity_id uuid, p_contact_method_id uuid, p_type text, p_outcome text, p_body text default null,
  p_follow_up_at timestamptz default null, p_follow_up_action text default null, p_follow_up_purpose text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_assignment uuid; v_workspace uuid; v_activity uuid; v_restricted boolean;
begin
  select a.id, o.workspace_id into v_assignment, v_workspace from public.assignments a join public.opportunities o on o.id = a.opportunity_id where a.opportunity_id = p_opportunity_id and a.assigned_to = auth.uid() and a.ended_at is null;
  if public.current_role() <> 'sales_agent' or v_assignment is null then raise exception 'Only the current Sales owner can log sales activity'; end if;
  if p_type not in ('call','sms','email','meeting','note') or p_outcome not in ('connected','no_answer','voicemail','busy','callback_requested','email_sent','replied','meeting_booked','not_interested','other') then raise exception 'Invalid activity type or outcome'; end if;
  select globally_restricted into v_restricted from public.contact_methods where id = p_contact_method_id;
  if v_restricted then raise exception 'This contact method is Do Not Contact'; end if;
  if not exists(select 1 from public.opportunity_contact_methods where opportunity_id = p_opportunity_id and contact_method_id = p_contact_method_id and focus <> 'removed') then raise exception 'Choose an active or secondary contact method'; end if;
  insert into public.activities(opportunity_id, actor_id, assignment_id, contact_method_id, type, outcome, body, occurred_at, metadata)
  values(p_opportunity_id, auth.uid(), v_assignment, p_contact_method_id, p_type, p_outcome, nullif(trim(p_body),''), now(), jsonb_build_object('workflow','lead-v1.6')) returning id into v_activity;
  if p_follow_up_at is not null then
    if p_follow_up_at <= now() then raise exception 'Follow-up must be scheduled in the future'; end if;
    insert into public.follow_ups(opportunity_id, owner_id, due_at, action_type, contact_method_id, purpose, timezone)
    values(p_opportunity_id, auth.uid(), p_follow_up_at, coalesce(nullif(trim(p_follow_up_action),''), initcap(p_type)), p_contact_method_id, nullif(trim(p_follow_up_purpose),''), 'UTC');
  end if;
  if p_outcome in ('connected','replied','meeting_booked') then update public.opportunities set status = case when status in ('new','assigned','contacted','follow_up_required') then 'connected' else status end where id = p_opportunity_id; end if;
  return v_activity;
end;
$$;

-- Explicit incorrect-lead reports do not close the opportunity. Only the Admin decision does.
create or replace function public.report_incorrect_lead(p_opportunity_id uuid, p_reason_code text, p_evidence text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'sales_agent' or not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null) then raise exception 'Only the current Sales owner may report an incorrect lead'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is already paused pending review'; end if;
  if nullif(trim(p_reason_code), '') is null then raise exception 'An incorrect-lead reason is required'; end if;
  insert into public.incorrect_reports(opportunity_id, reporter_id, reason_code, evidence) values(p_opportunity_id, auth.uid(), trim(p_reason_code), nullif(trim(p_evidence), ''));
  insert into public.activities(opportunity_id, actor_id, assignment_id, type, body, metadata) values(p_opportunity_id, auth.uid(), public.current_assignment_id(p_opportunity_id), 'incorrect_report', 'Incorrect lead reported', jsonb_build_object('reason', trim(p_reason_code)));
end;
$$;

-- Sales can set SQL but never MQL; Lead Gen can set MQL but never SQL or Sales lifecycle stages.
create or replace function public.set_opportunity_status(p_opportunity_id uuid, p_status public.opportunity_status, p_qualification public.qualification_level default null) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.opportunity_status; v_role public.app_role := public.current_role();
begin
  select status into v_old from public.opportunities where id = p_opportunity_id for update;
  if v_old is null or not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is paused pending Incorrect Review'; end if;
  if v_role = 'sales_agent' and (not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null) or p_qualification = 'mql') then raise exception 'Sales may update only their lead and cannot set MQL'; end if;
  if v_role = 'marketer' and (p_qualification = 'sql' or p_status not in ('new','assigned','contacted','follow_up_required')) then raise exception 'Lead Gen may set MQL and route work, but cannot update Sales stages'; end if;
  if v_old in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') or p_status = 'new' then raise exception 'This status transition is not allowed'; end if;
  update public.opportunities set status = p_status, qualification = coalesce(p_qualification, qualification), closed_at = case when p_status in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') then now() else null end where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, assignment_id, type, from_status, to_status, body, metadata) values(p_opportunity_id, auth.uid(), public.current_assignment_id(p_opportunity_id), case when p_qualification is not null and p_qualification <> (select qualification from public.opportunities where id = p_opportunity_id) then 'qualification_change' else 'status_change' end, v_old, p_status, 'Status updated', jsonb_build_object('qualification', p_qualification));
end;
$$;

create or replace view public.opportunity_sales_engagement with (security_invoker = true) as
select o.id as opportunity_id,
  min(a.occurred_at) filter (where a.actor_id = ass.assigned_to and a.occurred_at >= ass.started_at and (ass.ended_at is null or a.occurred_at < ass.ended_at)) as first_worked_at,
  min(a.occurred_at) filter (where a.actor_id = ass.assigned_to and a.outcome = 'connected' and a.occurred_at >= ass.started_at and (ass.ended_at is null or a.occurred_at < ass.ended_at)) as connected_at,
  min(a.occurred_at) filter (where a.type = 'qualification_change' and a.metadata ->> 'qualification' = 'sql') as sql_entered_at,
  least(
    min(a.occurred_at) filter (where a.actor_id = ass.assigned_to and a.outcome = 'connected' and a.occurred_at >= ass.started_at and (ass.ended_at is null or a.occurred_at < ass.ended_at)),
    min(a.occurred_at) filter (where a.type = 'qualification_change' and a.metadata ->> 'qualification' = 'sql')
  ) as sales_engaged_at
from public.opportunities o
left join public.assignments ass on ass.opportunity_id = o.id
left join public.activities a on a.opportunity_id = o.id
group by o.id;

grant select on public.contact_methods, public.opportunity_contact_methods, public.contact_method_events, public.assignment_contact_method_decisions, public.opportunity_sales_engagement to authenticated;
grant execute on function public.current_assignment_id(uuid), public.can_manage_contact_quality(uuid), public.add_opportunity_contact_method(uuid, public.contact_method_type, text, text), public.assess_opportunity_contact_method(uuid, uuid, public.contact_method_health, text), public.restore_opportunity_contact_method(uuid, uuid, text), public.log_sales_activity(uuid, uuid, text, text, text, timestamptz, text, text) to authenticated;
