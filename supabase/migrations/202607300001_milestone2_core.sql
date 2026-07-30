-- Milestone 2 CRM-core completion: persist follow-up completion in the same
-- permission and audit boundary as the other lead actions.
create or replace function public.complete_follow_up(p_follow_up_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_opportunity uuid;
  v_owner uuid;
  v_status public.follow_up_status;
begin
  select opportunity_id, owner_id, status into v_opportunity, v_owner, v_status
  from public.follow_ups where id = p_follow_up_id for update;
  if v_opportunity is null then raise exception 'Follow-up not found'; end if;
  if not public.can_write_opportunity(v_opportunity) then raise exception 'Not permitted'; end if;
  if public.current_role() = 'sales_agent' and v_owner <> auth.uid() then raise exception 'Only the follow-up owner may complete this task'; end if;
  if v_status in ('completed', 'cancelled') then raise exception 'This follow-up is already closed'; end if;
  update public.follow_ups set status = 'completed', completed_at = now() where id = p_follow_up_id;
  insert into public.activities(opportunity_id, actor_id, type, body, metadata)
  values(v_opportunity, auth.uid(), 'follow_up', 'Follow-up completed', jsonb_build_object('follow_up_id', p_follow_up_id));
end;
$$;
