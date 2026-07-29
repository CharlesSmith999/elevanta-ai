-- CRM controls for Phase 1. Run after 202607280001_foundation.sql.
do $$ begin
  create type public.qualification_level as enum ('mql', 'sql', 'not_available');
exception when duplicate_object then null;
end $$;

alter table public.opportunities
  add column if not exists marketing_owner_id uuid references public.profiles(id),
  add column if not exists qualification public.qualification_level not null default 'not_available',
  add column if not exists routing_paused_at timestamptz,
  add column if not exists routing_pause_reason text,
  add column if not exists lost_reason text,
  add column if not exists closed_at timestamptz;

create index if not exists opportunities_marketing_owner_idx on public.opportunities(marketing_owner_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at before update on public.contacts for each row execute function public.touch_updated_at();
drop trigger if exists opportunities_touch_updated_at on public.opportunities;
create trigger opportunities_touch_updated_at before update on public.opportunities for each row execute function public.touch_updated_at();

create or replace function public.can_access_opportunity(target_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.opportunities opportunity
    left join public.assignments assignment on assignment.opportunity_id = opportunity.id and assignment.ended_at is null
    left join public.profiles assignee on assignee.id = assignment.assigned_to
    where opportunity.id = target_opportunity_id
      and opportunity.workspace_id = public.current_workspace_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'marketer' and opportunity.marketing_owner_id = auth.uid())
        or assignment.assigned_to = auth.uid()
        or (public.current_role() = 'manager' and assignee.manager_id = auth.uid())
      )
  )
$$;

create or replace function public.can_write_opportunity(target_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.opportunities opportunity
    left join public.assignments assignment on assignment.opportunity_id = opportunity.id and assignment.ended_at is null
    left join public.profiles assignee on assignee.id = assignment.assigned_to
    where opportunity.id = target_opportunity_id
      and opportunity.workspace_id = public.current_workspace_id()
      and (
        public.current_role() = 'admin'
        or (public.current_role() = 'marketer' and opportunity.marketing_owner_id = auth.uid())
        or assignment.assigned_to = auth.uid()
        or (public.current_role() = 'manager' and assignee.manager_id = auth.uid())
      )
  )
$$;

create or replace function public.queue_incorrect_review_after_threshold() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.incorrect_reports where opportunity_id = new.opportunity_id) >= 3 then
    insert into public.incorrect_reviews (opportunity_id) values (new.opportunity_id) on conflict (opportunity_id) do nothing;
    update public.opportunities set routing_paused_at = now(), routing_pause_reason = 'Three independent incorrect-lead reports are awaiting Admin review' where id = new.opportunity_id and routing_paused_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.create_opportunity(
  p_name text, p_phone text default null, p_email text default null, p_source text default null,
  p_marketing_owner_id uuid default null, p_sales_owner_id uuid default null, p_description text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_workspace uuid := public.current_workspace_id(); v_contact uuid; v_opportunity uuid; v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\\D', '', 'g'), ''); v_email text := nullif(lower(trim(coalesce(p_email, ''))), ''); v_existing_phone uuid; v_existing_email uuid;
begin
  if public.current_role() not in ('admin', 'marketer') then raise exception 'Only Admin and Marketing may create leads'; end if;
  if nullif(trim(p_name), '') is null or (v_phone is null and v_email is null) then raise exception 'A lead requires name plus phone or email'; end if;
  if v_workspace is null then raise exception 'No workspace profile found'; end if;
  if public.current_role() = 'marketer' and coalesce(p_marketing_owner_id, auth.uid()) <> auth.uid() then raise exception 'Marketing users may create only their own leads'; end if;
  select id into v_existing_phone from public.contacts where workspace_id = v_workspace and normalized_phone = v_phone;
  select id into v_existing_email from public.contacts where workspace_id = v_workspace and normalized_email = v_email;
  if v_existing_phone is not null and v_existing_email is not null and v_existing_phone <> v_existing_email then raise exception 'Phone and email match different existing contacts; resolve the duplicate first'; end if;
  v_contact := coalesce(v_existing_phone, v_existing_email);
  if v_contact is null then insert into public.contacts(workspace_id, name, normalized_phone, normalized_email, source) values(v_workspace, trim(p_name), v_phone, v_email, nullif(trim(p_source), '')) returning id into v_contact; end if;
  insert into public.opportunities(workspace_id, contact_id, source, description, marketing_owner_id, status) values(v_workspace, v_contact, nullif(trim(p_source), ''), nullif(trim(p_description), ''), coalesce(p_marketing_owner_id, auth.uid()), case when p_sales_owner_id is null then 'new' else 'assigned' end) returning id into v_opportunity;
  if p_sales_owner_id is not null then
    if not exists(select 1 from public.profiles where id = p_sales_owner_id and workspace_id = v_workspace and role = 'sales_agent' and active) then raise exception 'Sales owner must be an active sales agent in this workspace'; end if;
    insert into public.assignments(opportunity_id, assigned_to, assigned_by, reason) values(v_opportunity, p_sales_owner_id, auth.uid(), 'Initial assignment');
  end if;
  insert into public.activities(opportunity_id, actor_id, type, body) values(v_opportunity, auth.uid(), 'created', 'Lead created');
  return v_opportunity;
end;
$$;

create or replace function public.reassign_opportunity(p_opportunity_id uuid, p_assigned_to uuid, p_visibility public.assignment_visibility, p_reason text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Routing is paused pending Incorrect Review'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A handoff reason is required'; end if;
  if not exists(select 1 from public.profiles where id = p_assigned_to and workspace_id = public.current_workspace_id() and role = 'sales_agent' and active) then raise exception 'Invalid sales owner'; end if;
  if public.current_role() = 'manager' and not exists(select 1 from public.profiles where id = p_assigned_to and manager_id = auth.uid()) then raise exception 'Managers may assign only their own sales team'; end if;
  update public.assignments set ended_at = now() where opportunity_id = p_opportunity_id and ended_at is null;
  insert into public.assignments(opportunity_id, assigned_to, assigned_by, visibility_mode, reason) values(p_opportunity_id, p_assigned_to, auth.uid(), p_visibility, trim(p_reason));
  update public.opportunities set status = case when status = 'new' then 'assigned' else status end where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, type, body, metadata) values(p_opportunity_id, auth.uid(), 'assignment', 'Lead reassigned', jsonb_build_object('assigned_to', p_assigned_to, 'visibility', p_visibility, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.set_opportunity_status(p_opportunity_id uuid, p_status public.opportunity_status, p_qualification public.qualification_level default null) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.opportunity_status;
begin
  if not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  select status into v_old from public.opportunities where id = p_opportunity_id for update;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is paused pending Incorrect Review'; end if;
  if v_old in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') or p_status = 'new' then raise exception 'This status transition is not allowed'; end if;
  update public.opportunities set status = p_status, qualification = coalesce(p_qualification, qualification), closed_at = case when p_status in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') then now() else null end where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, type, from_status, to_status, body) values(p_opportunity_id, auth.uid(), 'status_change', v_old, p_status, 'Status updated');
end;
$$;

create or replace function public.add_opportunity_note(p_opportunity_id uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_opportunity(p_opportunity_id) or exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Not permitted'; end if;
  if nullif(trim(p_body), '') is null then raise exception 'A note cannot be empty'; end if;
  insert into public.activities(opportunity_id, actor_id, type, body) values(p_opportunity_id, auth.uid(), 'note', trim(p_body));
end;
$$;

create or replace function public.create_follow_up(p_opportunity_id uuid, p_due_at timestamptz, p_action_type text) returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.can_write_opportunity(p_opportunity_id) or exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Not permitted'; end if;
  if p_due_at <= now() then raise exception 'Follow-up must be scheduled in the future'; end if;
  select assigned_to into v_owner from public.assignments where opportunity_id = p_opportunity_id and ended_at is null;
  if v_owner is null then raise exception 'Assign the lead before creating a follow-up'; end if;
  insert into public.follow_ups(opportunity_id, owner_id, due_at, action_type) values(p_opportunity_id, v_owner, p_due_at, trim(p_action_type));
  insert into public.activities(opportunity_id, actor_id, type, body) values(p_opportunity_id, auth.uid(), 'follow_up', 'Follow-up scheduled');
end;
$$;

create or replace function public.report_incorrect_lead(p_opportunity_id uuid, p_reason_code text, p_evidence text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'sales_agent' or not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null) then raise exception 'Only the current sales owner may report an incorrect lead'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is already paused pending review'; end if;
  if nullif(trim(p_reason_code), '') is null then raise exception 'An incorrect-lead reason is required'; end if;
  insert into public.incorrect_reports(opportunity_id, reporter_id, reason_code, evidence) values(p_opportunity_id, auth.uid(), trim(p_reason_code), nullif(trim(p_evidence), ''));
  update public.opportunities set status = 'incorrect' where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, type, body) values(p_opportunity_id, auth.uid(), 'incorrect_report', 'Incorrect lead reported');
end;
$$;

create or replace function public.decide_incorrect_review(p_opportunity_id uuid, p_decision text, p_reason text default null) returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_role() <> 'admin' then raise exception 'Only Admin may decide Incorrect Reviews'; end if;
  if p_decision not in ('confirmed_incorrect','rejected','merge_duplicate') then raise exception 'Invalid review decision'; end if;
  update public.incorrect_reviews set reviewer_id = auth.uid(), decision = p_decision, decision_reason = nullif(trim(p_reason), ''), decided_at = now() where opportunity_id = p_opportunity_id and decision is null;
  if not found then raise exception 'No pending review found'; end if;
  update public.opportunities set routing_paused_at = null, routing_pause_reason = null, status = case p_decision when 'confirmed_incorrect' then 'incorrect' when 'merge_duplicate' then 'duplicate' else 'follow_up_required' end, closed_at = case when p_decision in ('confirmed_incorrect','merge_duplicate') then now() else null end where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, type, body, metadata) values(p_opportunity_id, auth.uid(), 'incorrect_review', 'Admin Incorrect Review decision', jsonb_build_object('decision', p_decision));
end;
$$;

drop policy if exists "contacts limited to visible opportunities" on public.contacts;
create policy "contacts limited to visible opportunities" on public.contacts for select using (workspace_id = public.current_workspace_id() and (public.current_role() = 'admin' or exists (select 1 from public.opportunities where contact_id = contacts.id and public.can_access_opportunity(opportunities.id))));
