-- Calling view query indexes. Additive only, with no data or permission changes.
create index if not exists activities_call_opportunity_idx
  on public.activities(opportunity_id, occurred_at desc, id)
  where type = 'call';

create index if not exists follow_ups_open_opportunity_idx
  on public.follow_ups(opportunity_id, due_at, id)
  where status = 'open';
