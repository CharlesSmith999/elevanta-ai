-- Replace the six-argument public status RPC used by the API with v1.6 role rules.
create or replace function public.set_opportunity_status(
  p_opportunity_id uuid,
  p_status public.opportunity_status,
  p_qualification public.qualification_level default null,
  p_total_project_cost numeric default null,
  p_upfront_payment_amount numeric default null,
  p_lost_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.opportunity_status; v_old_qualification public.qualification_level; v_role public.app_role := public.current_role();
begin
  select status, qualification into v_old, v_old_qualification from public.opportunities where id = p_opportunity_id for update;
  if v_old is null or not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is paused pending Incorrect Review'; end if;
  if v_role = 'sales_agent' and (not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null) or p_qualification = 'mql') then raise exception 'Sales may update only their lead and cannot set MQL'; end if;
  if v_role = 'marketer' and (p_qualification = 'sql' or p_status not in ('new','assigned','contacted','follow_up_required')) then raise exception 'Lead Gen may set MQL and route work, but cannot update Sales stages'; end if;
  if v_old in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') or p_status = 'new' then raise exception 'This status transition is not allowed'; end if;
  if p_status = 'won' and (p_total_project_cost is null or p_upfront_payment_amount is null or p_total_project_cost < 0 or p_upfront_payment_amount < 0 or p_upfront_payment_amount > p_total_project_cost) then raise exception 'Won opportunities require valid total project cost and upfront payment amount'; end if;
  if p_status in ('lost','not_interested') and nullif(trim(coalesce(p_lost_reason,'')), '') is null then raise exception 'Lost and Not Interested opportunities require a loss reason'; end if;
  if p_lost_reason is not null and trim(p_lost_reason) not in ('Price or budget','No response','Timing or priority','Competitor selected','Not a fit','Proposal declined','Other') then raise exception 'Invalid loss reason'; end if;
  update public.opportunities set
    status = p_status, qualification = coalesce(p_qualification, qualification),
    total_project_cost = case when p_status = 'won' then p_total_project_cost else total_project_cost end,
    upfront_payment_amount = case when p_status = 'won' then p_upfront_payment_amount else upfront_payment_amount end,
    won_at = case when p_status = 'won' then coalesce(won_at, now()) else won_at end,
    lost_reason = case when p_status in ('lost','not_interested') then trim(p_lost_reason) else lost_reason end,
    first_contacted_at = case when p_status in ('contacted','connected') then coalesce(first_contacted_at, now()) else first_contacted_at end,
    qualified_at = case when p_status = 'qualified' then coalesce(qualified_at, now()) else qualified_at end,
    proposal_sent_at = case when p_status = 'proposal_sent' then coalesce(proposal_sent_at, now()) else proposal_sent_at end,
    closed_at = case when p_status in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') then coalesce(closed_at, now()) else null end
  where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, assignment_id, type, from_status, to_status, body, metadata)
  values(p_opportunity_id, auth.uid(), public.current_assignment_id(p_opportunity_id), case when p_qualification is not null and p_qualification <> v_old_qualification then 'qualification_change' else 'status_change' end, v_old, p_status, 'Status updated', jsonb_strip_nulls(jsonb_build_object('qualification', p_qualification, 'total_project_cost', case when p_status = 'won' then p_total_project_cost else null end, 'upfront_payment_amount', case when p_status = 'won' then p_upfront_payment_amount else null end, 'lost_reason', case when p_status in ('lost','not_interested') then trim(p_lost_reason) else null end)));
end;
$$;
