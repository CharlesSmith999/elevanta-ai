-- Xaviar v1.1 receives structured lead-workflow evidence only.
alter table public.xaviar_evidence drop constraint if exists xaviar_evidence_evidence_type_check;
alter table public.xaviar_evidence add constraint xaviar_evidence_evidence_type_check check (evidence_type in ('opportunity','activity','follow_up','metric','contact_method','assignment_contact_decision'));

create or replace view public.xaviar_event_stream with (security_invoker = true) as
select a.opportunity_id, a.id entity_id, a.type event_type, a.actor_id, coalesce(a.occurred_at, a.created_at) occurred_at,
  jsonb_build_object('from_status', a.from_status, 'to_status', a.to_status, 'outcome', a.outcome, 'assignment_id', a.assignment_id, 'contact_method_id', a.contact_method_id, 'metadata', a.metadata) event_metadata
from public.activities a
union all
select s.opportunity_id, s.id, 'assignment', s.assigned_by, s.started_at,
  jsonb_build_object('owner_id', s.assigned_to, 'ended_at', s.ended_at, 'visibility', s.visibility_mode)
from public.assignments s
union all
select f.opportunity_id, f.id, 'follow_up', f.owner_id, f.created_at,
  jsonb_build_object('due_at', f.due_at, 'status', f.status, 'completed_at', f.completed_at, 'contact_method_id', f.contact_method_id, 'purpose', f.purpose)
from public.follow_ups f
union all
select e.opportunity_id, e.id, concat('contact_method_', e.event_type), e.actor_id, e.created_at,
  jsonb_build_object('contact_method_id', e.contact_method_id, 'from_health', e.from_health, 'to_health', e.to_health, 'from_focus', e.from_focus, 'to_focus', e.to_focus, 'assignment_id', e.assignment_id)
from public.contact_method_events e
union all
select a.opportunity_id, d.id, 'assignment_contact_decision', d.decided_by, d.created_at,
  jsonb_build_object('assignment_id', d.assignment_id, 'contact_method_id', d.contact_method_id, 'decision', d.decision)
from public.assignment_contact_method_decisions d join public.assignments a on a.id = d.assignment_id;

grant select on public.xaviar_event_stream to authenticated;
