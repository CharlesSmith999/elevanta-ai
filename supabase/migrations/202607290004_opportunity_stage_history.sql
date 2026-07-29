-- Dashboard readiness Step 3: durable, reassignment-aware opportunity stage history.
-- Run after 202607290003_dashboard_data_definitions.sql.

create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  from_status public.opportunity_status,
  to_status public.opportunity_status not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz,
  changed_by uuid references public.profiles(id),
  reason text not null default 'Status changed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint opportunity_stage_history_valid_interval check (exited_at is null or exited_at >= entered_at)
);

create unique index if not exists opportunity_stage_history_one_open_stage
  on public.opportunity_stage_history(opportunity_id) where exited_at is null;
create index if not exists opportunity_stage_history_opportunity_entered_idx
  on public.opportunity_stage_history(opportunity_id, entered_at desc);
create index if not exists opportunity_stage_history_status_entered_idx
  on public.opportunity_stage_history(to_status, entered_at desc);

-- Existing opportunities predate this table. Their current stage is reconstructed from
-- the original record timestamp; no earlier stages are invented.
insert into public.opportunity_stage_history (opportunity_id, to_status, entered_at, reason, metadata)
select opportunity.id, opportunity.status, opportunity.created_at, 'Initial stage reconstructed', jsonb_build_object('reconstructed', true)
from public.opportunities opportunity
where not exists (
  select 1 from public.opportunity_stage_history history where history.opportunity_id = opportunity.id
);

create or replace function public.record_opportunity_stage_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_stage_history (
      opportunity_id, to_status, entered_at, changed_by, reason, metadata
    ) values (
      new.id, new.status, new.created_at, auth.uid(), 'Opportunity created', jsonb_build_object('event', 'created')
    ) on conflict (opportunity_id) where exited_at is null do nothing;
    return new;
  end if;

  if new.status is distinct from old.status then
    update public.opportunity_stage_history
      set exited_at = v_now
      where opportunity_id = new.id and exited_at is null;

    insert into public.opportunity_stage_history (
      opportunity_id, from_status, to_status, entered_at, changed_by, reason, metadata
    ) values (
      new.id,
      old.status,
      new.status,
      v_now,
      auth.uid(),
      'Status changed',
      jsonb_build_object('event', 'status_change', 'from_status', old.status, 'to_status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists opportunities_record_stage_history on public.opportunities;
create trigger opportunities_record_stage_history
after insert or update of status on public.opportunities
for each row execute function public.record_opportunity_stage_history();

alter table public.opportunity_stage_history enable row level security;
do $$ begin
  create policy "accessible opportunity stage history" on public.opportunity_stage_history
    for select using (public.can_access_opportunity(opportunity_id));
exception when duplicate_object then null;
end $$;

-- This view gives reporting queries the exact overlap between a stage and an owner.
-- A dashboard must use these intersections, not a lead's current owner, when attributing stage time.
create or replace view public.opportunity_stage_ownership_periods
with (security_invoker = true) as
select
  opportunity.workspace_id,
  history.opportunity_id,
  history.to_status as stage,
  assignment.assigned_to as owner_id,
  greatest(history.entered_at, assignment.started_at) as started_at,
  least(coalesce(history.exited_at, now()), coalesce(assignment.ended_at, now())) as ended_at
from public.opportunity_stage_history history
join public.opportunities opportunity on opportunity.id = history.opportunity_id
join public.assignments assignment on assignment.opportunity_id = history.opportunity_id
where greatest(history.entered_at, assignment.started_at)
  < least(coalesce(history.exited_at, now()), coalesce(assignment.ended_at, now()));
