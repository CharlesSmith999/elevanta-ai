-- Dashboard data definitions for Step 2. Run after the CRM core controls migration.

create table if not exists public.source_dictionary (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.source_dictionary (label) values
  ('Bark Paid'), ('Bark Stalk'), ('Thumbtack'), ('SEO'), ('Social Media'),
  ('Clutch'), ('Email Marketing'), ('LinkedIn'), ('PPC'), ('Other')
on conflict (label) do nothing;

alter table public.opportunities add column if not exists total_project_cost numeric(12,2);
alter table public.opportunities add column if not exists upfront_payment_amount numeric(12,2);
alter table public.opportunities add column if not exists won_at timestamptz;

update public.opportunities set source = nullif(trim(source), '') where source is not null;

alter table public.opportunities drop constraint if exists opportunities_project_cost_nonnegative;
alter table public.opportunities add constraint opportunities_project_cost_nonnegative
  check (total_project_cost is null or total_project_cost >= 0);
alter table public.opportunities drop constraint if exists opportunities_upfront_nonnegative;
alter table public.opportunities add constraint opportunities_upfront_nonnegative
  check (upfront_payment_amount is null or upfront_payment_amount >= 0);
alter table public.opportunities drop constraint if exists opportunities_upfront_within_total;
alter table public.opportunities add constraint opportunities_upfront_within_total
  check (upfront_payment_amount is null or total_project_cost is null or upfront_payment_amount <= total_project_cost);

create index if not exists opportunities_source_idx on public.opportunities(workspace_id, source);
create index if not exists opportunities_won_at_idx on public.opportunities(workspace_id, won_at);

create or replace function public.validate_source_label() returns trigger language plpgsql as $$
begin
  if nullif(trim(new.source), '') is null then
    new.source := 'Other';
  elsif not exists (select 1 from public.source_dictionary where label = trim(new.source) and active) then
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

alter table public.source_dictionary enable row level security;
do $$ begin
  create policy "source dictionary is readable" on public.source_dictionary
    for select using (true);
exception when duplicate_object then null;
end $$;

drop function if exists public.set_opportunity_status(uuid, public.opportunity_status, public.qualification_level);
create or replace function public.set_opportunity_status(
  p_opportunity_id uuid,
  p_status public.opportunity_status,
  p_qualification public.qualification_level default null,
  p_total_project_cost numeric default null,
  p_upfront_payment_amount numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.opportunity_status;
begin
  if not public.can_write_opportunity(p_opportunity_id) then raise exception 'Not permitted'; end if;
  select status into v_old from public.opportunities where id = p_opportunity_id for update;
  if exists(select 1 from public.opportunities where id = p_opportunity_id and routing_paused_at is not null) then raise exception 'Lead is paused pending Incorrect Review'; end if;
  if v_old in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') or p_status = 'new' then raise exception 'This status transition is not allowed'; end if;
  if p_status = 'won' and (p_total_project_cost is null or p_upfront_payment_amount is null) then raise exception 'Won opportunities require total project cost and upfront payment amount'; end if;
  if p_status = 'won' and (p_total_project_cost < 0 or p_upfront_payment_amount < 0 or p_upfront_payment_amount > p_total_project_cost) then raise exception 'Won financial values are invalid'; end if;
  update public.opportunities
    set status = p_status,
        qualification = coalesce(p_qualification, qualification),
        total_project_cost = case when p_status = 'won' then p_total_project_cost else total_project_cost end,
        upfront_payment_amount = case when p_status = 'won' then p_upfront_payment_amount else upfront_payment_amount end,
        won_at = case when p_status = 'won' then coalesce(won_at, now()) else won_at end,
        closed_at = case when p_status in ('won','lost','not_interested','incorrect','duplicate','do_not_contact') then coalesce(closed_at, now()) else null end
    where id = p_opportunity_id;
  insert into public.activities(opportunity_id, actor_id, type, from_status, to_status, body, metadata)
    values(p_opportunity_id, auth.uid(), 'status_change', v_old, p_status, 'Status updated',
      case when p_status = 'won' then jsonb_build_object('total_project_cost', p_total_project_cost, 'upfront_payment_amount', p_upfront_payment_amount) else '{}'::jsonb end);
end;
$$;
