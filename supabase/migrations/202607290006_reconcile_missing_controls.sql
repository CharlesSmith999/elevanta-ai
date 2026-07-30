-- Idempotent reconciliation for controls that may be absent in an existing
-- Supabase project. Run after the foundation, CRM controls, and dashboard
-- definition migrations. This patch does not drop data or tables.

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at before update on public.contacts
for each row execute function public.touch_updated_at();

drop trigger if exists opportunities_touch_updated_at on public.opportunities;
create trigger opportunities_touch_updated_at before update on public.opportunities
for each row execute function public.touch_updated_at();

create or replace function public.validate_source_label()
returns trigger language plpgsql as $$
begin
  if nullif(trim(new.source), '') is null then
    new.source := 'Other';
  elsif not exists (
    select 1 from public.source_dictionary
    where label = trim(new.source) and active
  ) then
    raise exception 'Source must use an approved source label';
  else
    new.source := trim(new.source);
  end if;
  return new;
end;
$$;

drop trigger if exists contacts_validate_source on public.contacts;
create trigger contacts_validate_source before insert or update of source on public.contacts
for each row execute function public.validate_source_label();

drop trigger if exists opportunities_validate_source on public.opportunities;
create trigger opportunities_validate_source before insert or update of source on public.opportunities
for each row execute function public.validate_source_label();

drop function if exists public.set_opportunity_status(uuid, public.opportunity_status, public.qualification_level);
drop function if exists public.set_opportunity_status(uuid, public.opportunity_status, public.qualification_level, numeric, numeric);
drop function if exists public.set_opportunity_status(uuid, public.opportunity_status, public.qualification_level, numeric, numeric, text);

create or replace function public.set_opportunity_status(
  p_opportunity_id uuid,
  p_status public.opportunity_status,
  p_qualification public.qualification_level default null,
  p_total_project_cost numeric default null,
  p_upfront_payment_amount numeric default null,
  p_lost_reason text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_old public.opportunity_status;
begin
  if not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  select status into v_old from public.opportunities where id = p_opportunity_id for update;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then
    raise exception 'Lead is paused pending Incorrect Review';
  end if;
  if v_old in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') or p_status = 'new' then
    raise exception 'This status transition is not allowed';
  end if;
  if p_status = 'won' and (p_total_project_cost is null or p_upfront_payment_amount is null) then
    raise exception 'Won opportunities require total project cost and upfront payment amount';
  end if;
  if p_status = 'won' and (p_total_project_cost < 0 or p_upfront_payment_amount < 0 or p_upfront_payment_amount > p_total_project_cost) then
    raise exception 'Won financial values are invalid';
  end if;
  if p_status in ('lost','not_interested') and nullif(trim(coalesce(p_lost_reason, '')), '') is null then
    raise exception 'Lost and Not Interested opportunities require a loss reason';
  end if;
  if p_lost_reason is not null and trim(p_lost_reason) not in ('Price or budget','No response','Timing or priority','Competitor selected','Not a fit','Proposal declined','Other') then
    raise exception 'Invalid loss reason';
  end if;

  update public.opportunities set
    status = p_status,
    qualification = coalesce(p_qualification, qualification),
    total_project_cost = case when p_status = 'won' then p_total_project_cost else total_project_cost end,
    upfront_payment_amount = case when p_status = 'won' then p_upfront_payment_amount else upfront_payment_amount end,
    won_at = case when p_status = 'won' then coalesce(won_at, now()) else won_at end,
    lost_reason = case when p_status in ('lost','not_interested') then trim(p_lost_reason) else lost_reason end,
    first_contacted_at = case when p_status in ('contacted','connected') then coalesce(first_contacted_at, now()) else first_contacted_at end,
    qualified_at = case when p_status = 'qualified' then coalesce(qualified_at, now()) else qualified_at end,
    proposal_sent_at = case when p_status = 'proposal_sent' then coalesce(proposal_sent_at, now()) else proposal_sent_at end,
    closed_at = case when p_status in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') then coalesce(closed_at, now()) else null end
  where id = p_opportunity_id;

  insert into public.activities(opportunity_id, actor_id, type, from_status, to_status, body, metadata)
  values(p_opportunity_id, auth.uid(), 'status_change', v_old, p_status, 'Status updated', jsonb_strip_nulls(jsonb_build_object(
    'total_project_cost', case when p_status = 'won' then p_total_project_cost else null end,
    'upfront_payment_amount', case when p_status = 'won' then p_upfront_payment_amount else null end,
    'lost_reason', case when p_status in ('lost','not_interested') then trim(p_lost_reason) else null end
  )));
end;
$$;
