-- Allow Admins to test the calling workflow without impersonating an agent.
-- Activities remain attributed to auth.uid(), so Admin actions never inflate agent metrics.
create or replace function public.log_calling_result(
  p_opportunity_id uuid, p_contact_method_id uuid, p_request_id uuid,
  p_outcome text, p_body text default null, p_follow_up_at timestamptz default null,
  p_lost_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead public.opportunities; v_activity uuid; v_method public.opportunity_contact_methods;
begin
  select * into v_lead from public.opportunities where id = p_opportunity_id for update;
  if v_lead.id is null or not public.can_access_opportunity(p_opportunity_id)
    or public.current_role() not in ('sales_agent','admin')
    or not exists(select 1 from public.profiles where id = auth.uid() and active)
    or (public.current_role() = 'sales_agent' and not exists(select 1 from public.assignments where opportunity_id = p_opportunity_id and assigned_to = auth.uid() and ended_at is null))
    then raise exception 'Only the current Sales owner or an Admin can log a call'; end if;
  select id into v_activity from public.activities where opportunity_id = p_opportunity_id
    and actor_id = auth.uid() and metadata->>'calling_request_id' = p_request_id::text;
  if v_activity is not null then return v_activity; end if;
  if p_request_id is null then raise exception 'A request identifier is required'; end if;
  if v_lead.routing_paused_at is not null or v_lead.status in ('incorrect','duplicate','do_not_contact','won','lost','not_interested')
    then raise exception 'This lead is not available for calling'; end if;
  select * into v_method from public.opportunity_contact_methods where opportunity_id = p_opportunity_id and contact_method_id = p_contact_method_id for update;
  if v_method.id is null or v_method.focus = 'removed' or v_method.health in ('incorrect','wrong_person','do_not_contact')
    or not exists(select 1 from public.contact_methods where id = p_contact_method_id and method_type = 'phone' and not globally_restricted)
    then raise exception 'Choose a usable phone number'; end if;
  if p_outcome not in ('connected','no_answer','voicemail','busy','callback_requested','meeting_booked','not_interested','wrong_number','other') then raise exception 'Choose a valid call result'; end if;
  if p_outcome = 'callback_requested' and (p_follow_up_at is null or p_follow_up_at <= now()) then raise exception 'Choose a future callback date and time'; end if;
  if p_outcome = 'not_interested' and (p_lost_reason is null or p_lost_reason not in ('Price or budget','No response','Timing or priority','Competitor selected','Not a fit','Proposal declined','Other')) then raise exception 'Choose a loss reason'; end if;
  v_activity := public.log_sales_activity(p_opportunity_id, p_contact_method_id, 'call', case when p_outcome = 'wrong_number' then 'other' else p_outcome end, case when p_outcome = 'wrong_number' then concat('Wrong number. ',p_body) else p_body end, p_follow_up_at, 'Call', case when p_follow_up_at is not null then 'Calling view follow-up' else null end);
  update public.activities set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('calling_request_id',p_request_id,'calling_outcome',p_outcome) where id = v_activity;
  if p_outcome = 'wrong_number' then perform public.assess_opportunity_contact_method(p_opportunity_id,p_contact_method_id,'wrong_person','Wrong number reported in calling view');
  elsif p_outcome = 'not_interested' then perform public.set_opportunity_status(p_opportunity_id,'not_interested',null,null,null,p_lost_reason); end if;
  return v_activity;
end;
$$;
revoke all on function public.log_calling_result(uuid,uuid,uuid,text,text,timestamptz,text) from public, anon;
grant execute on function public.log_calling_result(uuid,uuid,uuid,text,text,timestamptz,text) to authenticated;
