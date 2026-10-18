-- Additive indexes for the lead inbox, assignment ordering, dashboards, and follow-up queues.
-- These indexes do not change data, permissions, or business rules.
create index if not exists opportunities_workspace_created_idx
  on public.opportunities(workspace_id, created_at desc, id);

create index if not exists opportunities_workspace_updated_idx
  on public.opportunities(workspace_id, updated_at desc, id);

create index if not exists opportunities_workspace_source_idx
  on public.opportunities(workspace_id, source);

create index if not exists assignments_active_owner_started_idx
  on public.assignments(assigned_to, started_at desc, opportunity_id)
  where ended_at is null;

create index if not exists assignments_opportunity_started_idx
  on public.assignments(opportunity_id, started_at desc);

create index if not exists follow_ups_open_owner_due_idx
  on public.follow_ups(owner_id, due_at, opportunity_id)
  where status in ('open', 'overdue');
