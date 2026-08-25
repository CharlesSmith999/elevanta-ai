-- Lead workflow v1.7: controlled categories, Marketing-side detail editing,
-- type-safe contact entry, and Sales-only incorrect-review thresholds.
-- Additive only. No real lead data is imported or activated.

alter table public.opportunities
  add column if not exists lead_category text not null default 'not_available';

alter table public.opportunities
  drop constraint if exists opportunities_lead_category_check;
alter table public.opportunities
  add constraint opportunities_lead_category_check
  check (lead_category in ('app','game','seo','smm','web','not_available'));

alter table public.incorrect_reports
  add column if not exists reporter_role public.app_role;
update public.incorrect_reports r
set reporter_role = p.role
from public.profiles p
where p.id = r.reporter_id and r.reporter_role is null;

create or replace function public.can_access_opportunity(target_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.opportunities opportunity
    left join public.assignments assignment on assignment.opportunity_id = opportunity.id and assignment.ended_at is null
    left join public.profiles assignee on assignee.id = assignment.assigned_to
    left join public.profiles marketing_owner on marketing_owner.id = opportunity.marketing_owner_id
    left join public.profiles viewer on viewer.id = auth.uid()
    where opportunity.id = target_opportunity_id
      and opportunity.workspace_id = public.current_workspace_id()
      and (
        viewer.role = 'admin'
        or (viewer.role = 'marketer' and opportunity.marketing_owner_id = auth.uid())
        or assignment.assigned_to = auth.uid()
        or (viewer.role = 'manager' and viewer.department = 'sales' and assignee.manager_id = auth.uid())
        or (viewer.role = 'manager' and viewer.department = 'marketing' and marketing_owner.manager_id = auth.uid())
      )
  )
$$;

create or replace function public.can_write_opportunity(target_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_opportunity(target_opportunity_id)
$$;

create or replace function public.can_edit_lead_details(p_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.opportunities o
    left join public.profiles marketing_owner on marketing_owner.id = o.marketing_owner_id
    left join public.profiles viewer on viewer.id = auth.uid()
    where o.id = p_opportunity_id
      and o.workspace_id = public.current_workspace_id()
      and (
        viewer.role = 'admin'
        or (viewer.role = 'marketer' and o.marketing_owner_id = auth.uid())
        or (viewer.role = 'manager' and viewer.department = 'marketing' and marketing_owner.manager_id = auth.uid())
      )
  )
$$;

create or replace function public.create_opportunity_v17(
  p_name text, p_phone text default null, p_email text default null, p_source text default null,
  p_marketing_owner_id uuid default null, p_sales_owner_id uuid default null, p_description text default null,
  p_lead_category text default 'not_available'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_contact uuid;
  v_opportunity uuid;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_existing_phone uuid;
  v_existing_email uuid;
  v_category text := coalesce(nullif(lower(trim(p_lead_category)), ''), 'not_available');
begin
  if public.current_role() not in ('admin', 'marketer') then raise exception 'Only Admin and Marketing may create leads'; end if;
  if nullif(trim(p_name), '') is null or (v_phone is null and v_email is null) then raise exception 'A lead requires name plus phone or email'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Provide a valid email'; end if;
  if v_phone is not null and length(v_phone) not between 7 and 15 then raise exception 'Provide a valid phone number'; end if;
  if v_category not in ('app','game','seo','smm','web','not_available') then raise exception 'Invalid lead category'; end if;
  if v_workspace is null then raise exception 'No workspace profile found'; end if;
  if public.current_role() = 'marketer' and coalesce(p_marketing_owner_id, auth.uid()) <> auth.uid() then raise exception 'Marketing users may create only their own leads'; end if;
  select contact_id into v_existing_phone from public.contact_methods where workspace_id = v_workspace and method_type = 'phone' and normalized_value = v_phone;
  select contact_id into v_existing_email from public.contact_methods where workspace_id = v_workspace and method_type = 'email' and normalized_value = v_email;
  if v_existing_phone is not null and v_existing_email is not null and v_existing_phone <> v_existing_email then raise exception 'Phone and email match different existing contacts; resolve the duplicate first'; end if;
  v_contact := coalesce(v_existing_phone, v_existing_email);
  if v_contact is null then
    insert into public.contacts(workspace_id, name, normalized_phone, normalized_email, source)
    values(v_workspace, trim(p_name), v_phone, v_email, nullif(trim(p_source), '')) returning id into v_contact;
  end if;
  insert into public.opportunities(workspace_id, contact_id, source, description, lead_category, marketing_owner_id, status)
  values(v_workspace, v_contact, nullif(trim(p_source), ''), nullif(trim(p_description), ''), v_category, coalesce(p_marketing_owner_id, auth.uid()), case when p_sales_owner_id is null then 'new' else 'assigned' end)
  returning id into v_opportunity;
  if v_phone is not null then
    insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_by)
    values(v_workspace, v_contact, 'phone', trim(p_phone), v_phone, auth.uid())
    on conflict (workspace_id, method_type, normalized_value) do nothing;
  end if;
  if v_email is not null then
    insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_by)
    values(v_workspace, v_contact, 'email', trim(p_email), v_email, auth.uid())
    on conflict (workspace_id, method_type, normalized_value) do nothing;
  end if;
  insert into public.opportunity_contact_methods(opportunity_id, contact_method_id, health, focus)
  select v_opportunity, cm.id,
    case when cm.globally_restricted then 'do_not_contact'::public.contact_method_health else 'unverified'::public.contact_method_health end,
    case when cm.globally_restricted then 'removed'::public.contact_method_focus else 'active'::public.contact_method_focus end
  from public.contact_methods cm
  where cm.contact_id = v_contact and (
    (v_phone is not null and cm.method_type = 'phone' and cm.normalized_value = v_phone)
    or (v_email is not null and cm.method_type = 'email' and cm.normalized_value = v_email)
  )
  on conflict (opportunity_id, contact_method_id) do nothing;
  if p_sales_owner_id is not null then
    if not exists(select 1 from public.profiles where id = p_sales_owner_id and workspace_id = v_workspace and role = 'sales_agent' and active) then raise exception 'Sales owner must be an active sales agent in this workspace'; end if;
    insert into public.assignments(opportunity_id, assigned_to, assigned_by, reason) values(v_opportunity, p_sales_owner_id, auth.uid(), 'Initial assignment');
  end if;
  insert into public.activities(opportunity_id, actor_id, type, body, metadata)
  values(v_opportunity, auth.uid(), 'created', 'Lead created', jsonb_build_object('lead_category', v_category, 'description_supplied', p_description is not null));
  return v_opportunity;
end;
$$;

create or replace function public.update_lead_details(
  p_opportunity_id uuid, p_name text, p_source text, p_description text, p_lead_category text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_opportunity public.opportunities;
  v_contact public.contacts;
  v_category text := coalesce(nullif(lower(trim(p_lead_category)), ''), 'not_available');
  v_before jsonb;
  v_after jsonb;
begin
  select * into v_opportunity from public.opportunities where id = p_opportunity_id for update;
  if v_opportunity.id is null then raise exception 'Lead not found'; end if;
  if not public.can_edit_lead_details(p_opportunity_id) then raise exception 'Only Admin or permitted Marketing users may edit lead details'; end if;
  if nullif(trim(p_name), '') is null then raise exception 'Lead name is required'; end if;
  if v_category not in ('app','game','seo','smm','web','not_available') then raise exception 'Invalid lead category'; end if;
  select * into v_contact from public.contacts where id = v_opportunity.contact_id for update;
  v_before := jsonb_build_object('name', v_contact.name, 'source', v_opportunity.source, 'description', v_opportunity.description, 'lead_category', v_opportunity.lead_category);
  update public.contacts set name = trim(p_name) where id = v_opportunity.contact_id;
  update public.opportunities set source = nullif(trim(p_source), ''), description = nullif(trim(p_description), ''), lead_category = v_category where id = p_opportunity_id;
  v_after := jsonb_build_object('name', trim(p_name), 'source', nullif(trim(p_source), ''), 'description', nullif(trim(p_description), ''), 'lead_category', v_category);
  insert into public.activities(opportunity_id, actor_id, assignment_id, type, body, metadata)
  values(p_opportunity_id, auth.uid(), public.current_assignment_id(p_opportunity_id), 'lead_details_updated', 'Lead details updated', jsonb_build_object('before', v_before, 'after', v_after));
  insert into public.audit_events(workspace_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values(v_opportunity.workspace_id, auth.uid(), 'opportunity', p_opportunity_id, 'lead_details_updated', v_before, v_after);
end;
$$;

create or replace function public.queue_incorrect_review_after_threshold() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (
    select count(distinct reporter_id)
    from public.incorrect_reports
    where opportunity_id = new.opportunity_id and reporter_role = 'sales_agent'
  ) = 3 then
    insert into public.incorrect_reviews (opportunity_id) values (new.opportunity_id) on conflict (opportunity_id) do nothing;
    update public.opportunities
    set routing_paused_at = coalesce(routing_paused_at, now()),
        routing_pause_reason = 'Three independent Sales Agent incorrect-lead reports are awaiting Admin review'
    where id = new.opportunity_id;
  end if;
  return new;
end;
$$;

create or replace function public.add_opportunity_contact_method(
  p_opportunity_id uuid, p_method_type public.contact_method_type, p_value text, p_label text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_opportunity public.opportunities;
  v_normalized text;
  v_method uuid;
  v_existing_contact uuid;
  v_restricted boolean := false;
begin
  select * into v_opportunity from public.opportunities where id = p_opportunity_id;
  if v_opportunity.id is null or not public.can_manage_contact_quality(p_opportunity_id) then raise exception 'Not permitted'; end if;
  v_normalized := case when p_method_type = 'phone' then nullif(regexp_replace(coalesce(p_value,''), '\D','','g'),'') else nullif(lower(trim(coalesce(p_value,''))),'') end;
  if v_normalized is null or (p_method_type = 'phone' and length(v_normalized) not between 7 and 15) or (p_method_type = 'email' and v_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then raise exception 'Provide a valid %', p_method_type; end if;
  select id, contact_id, globally_restricted into v_method, v_existing_contact, v_restricted
  from public.contact_methods
  where workspace_id = v_opportunity.workspace_id and method_type = p_method_type and normalized_value = v_normalized;
  if v_method is not null and v_existing_contact <> v_opportunity.contact_id then raise exception 'This contact method belongs to another contact; resolve the duplicate first'; end if;
  if v_method is not null and exists(select 1 from public.opportunity_contact_methods where opportunity_id = p_opportunity_id and contact_method_id = v_method) then raise exception 'This contact method is already listed'; end if;
  if v_method is null then
    insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, label, created_by)
    values(v_opportunity.workspace_id, v_opportunity.contact_id, p_method_type, trim(p_value), v_normalized, nullif(trim(p_label),''), auth.uid())
    returning id, globally_restricted into v_method, v_restricted;
  end if;
  insert into public.opportunity_contact_methods(opportunity_id, contact_method_id, health, focus)
  values(p_opportunity_id, v_method,
    case when v_restricted then 'do_not_contact' else 'unverified' end,
    case when v_restricted then 'removed' else 'active' end);
  insert into public.contact_method_events(workspace_id, opportunity_id, assignment_id, contact_method_id, actor_id, event_type, to_health, to_focus)
  values(v_opportunity.workspace_id, p_opportunity_id, public.current_assignment_id(p_opportunity_id), v_method, auth.uid(), 'added',
    case when v_restricted then 'do_not_contact' else 'unverified' end,
    case when v_restricted then 'removed' else 'active' end);
  return v_method;
end;
$$;

create or replace function public.report_incorrect_lead(p_opportunity_id uuid, p_reason_code text, p_evidence text default null) returns void language plpgsql security definer set search_path = public as $$
declare v_role public.app_role := public.current_role();
begin
  if not public.can_access_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  if v_role = 'sales_agent' and not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null) then raise exception 'Only the current Sales owner may flag this lead'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is already paused pending review'; end if;
  if nullif(trim(p_reason_code), '') is null then raise exception 'An incorrect-lead reason is required'; end if;
  insert into public.incorrect_reports(opportunity_id, reporter_id, reporter_role, reason_code, evidence)
  values(p_opportunity_id, auth.uid(), v_role, trim(p_reason_code), nullif(trim(p_evidence), ''));
  insert into public.activities(opportunity_id, actor_id, assignment_id, type, body, metadata)
  values(p_opportunity_id, auth.uid(), public.current_assignment_id(p_opportunity_id), 'incorrect_report', 'Incorrect lead flag submitted', jsonb_build_object('reason', trim(p_reason_code), 'reporter_role', v_role, 'counts_toward_threshold', v_role = 'sales_agent'));
end;
$$;

grant execute on function public.can_edit_lead_details(uuid), public.create_opportunity_v17(text, text, text, text, uuid, uuid, text, text), public.update_lead_details(uuid, text, text, text, text), public.add_opportunity_contact_method(uuid, public.contact_method_type, text, text) to authenticated;
