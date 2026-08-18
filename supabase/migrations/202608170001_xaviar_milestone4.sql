-- Milestone 4 Xaviar foundation. Advisory only; no outbound or CRM mutation capability.
create type public.xaviar_recommendation_state as enum ('new', 'acknowledged', 'deferred', 'completed', 'dismissed');
create type public.xaviar_confidence as enum ('low', 'medium', 'high');

create table public.xaviar_performance_snapshots (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id), period_start timestamptz not null, period_end timestamptz not null,
  metrics jsonb not null default '{}'::jsonb, evidence_count integer not null default 0 check (evidence_count >= 0),
  data_quality jsonb not null default '{}'::jsonb, model_version text not null, created_at timestamptz not null default now(),
  unique (subject_user_id, period_start, period_end, model_version)
);

create table public.xaviar_recommendations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id), opportunity_id uuid references public.opportunities(id) on delete cascade,
  recommendation_key text not null,
  capability text not null check (capability in ('explain','recommend','coach','benchmark','predict')),
  title text not null, reason text not null, action text not null, confidence public.xaviar_confidence not null,
  priority text not null check (priority in ('high','medium','low')), state public.xaviar_recommendation_state not null default 'new',
  expires_at timestamptz not null, model_version text not null, prompt_version text, evidence_version text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index xaviar_recommendations_subject_idx on public.xaviar_recommendations(subject_user_id, state, created_at desc);
create unique index xaviar_recommendations_version_key on public.xaviar_recommendations(subject_user_id, recommendation_key, model_version);

create table public.xaviar_evidence (
  id uuid primary key default gen_random_uuid(), recommendation_id uuid not null references public.xaviar_recommendations(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('opportunity','activity','follow_up','metric')),
  entity_id uuid, label text not null, occurred_at timestamptz, created_at timestamptz not null default now()
);

create table public.xaviar_feedback (
  id uuid primary key default gen_random_uuid(), recommendation_id uuid not null references public.xaviar_recommendations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id), state public.xaviar_recommendation_state not null,
  reason text check (char_length(reason) <= 1000), created_at timestamptz not null default now()
);

create table public.xaviar_predictions (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id), opportunity_id uuid references public.opportunities(id) on delete cascade,
  outcome_type text not null check (outcome_type in ('connection','qualification','conversion','follow_up_risk','lead_quality')),
  probability numeric(5,4) check (probability between 0 and 1), confidence public.xaviar_confidence not null,
  sample_size integer not null check (sample_size >= 0), model_version text not null, predicted_at timestamptz not null,
  expires_at timestamptz not null, actual_outcome boolean, evaluated_at timestamptz, calibration_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.xaviar_coaching_plans (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_user_id uuid not null references public.profiles(id), manager_id uuid not null references public.profiles(id),
  title text not null, objective text not null, status text not null default 'draft' check (status in ('draft','active','completed','cancelled')),
  period_start date not null, period_end date not null, manager_notes text check (char_length(manager_notes) <= 3000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (period_end >= period_start)
);

create table public.xaviar_release_reviews (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id), release_version text not null,
  decision text not null check (decision in ('approved','changes_required')), notes text not null check (char_length(notes) between 1 and 3000),
  created_at timestamptz not null default now(), unique (reviewer_id, release_version)
);

create or replace function public.can_access_xaviar_subject(target_user_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles target
    where target.id = target_user_id and target.workspace_id = public.current_workspace_id()
      and (public.current_role() = 'admin' or target.id = auth.uid() or (public.current_role() = 'manager' and target.manager_id = auth.uid()))
  )
$$;

create or replace view public.xaviar_event_stream with (security_invoker = true) as
select a.opportunity_id, a.id entity_id, a.type event_type, a.actor_id, a.created_at occurred_at,
  jsonb_build_object('from_status', a.from_status, 'to_status', a.to_status) event_metadata
from public.activities a
union all
select s.opportunity_id, s.id, 'assignment', s.assigned_by, s.started_at,
  jsonb_build_object('owner_id', s.assigned_to, 'ended_at', s.ended_at, 'visibility', s.visibility_mode)
from public.assignments s
union all
select f.opportunity_id, f.id, 'follow_up', f.owner_id, f.created_at,
  jsonb_build_object('due_at', f.due_at, 'status', f.status, 'completed_at', f.completed_at)
from public.follow_ups f;

alter table public.xaviar_performance_snapshots enable row level security;
alter table public.xaviar_recommendations enable row level security;
alter table public.xaviar_evidence enable row level security;
alter table public.xaviar_feedback enable row level security;
alter table public.xaviar_predictions enable row level security;
alter table public.xaviar_coaching_plans enable row level security;
alter table public.xaviar_release_reviews enable row level security;

create policy "xaviar snapshots use subject scope" on public.xaviar_performance_snapshots for select using (public.can_access_xaviar_subject(subject_user_id));
create policy "xaviar recommendations use subject scope" on public.xaviar_recommendations for select using (public.can_access_xaviar_subject(subject_user_id));
create policy "xaviar evidence follows recommendation scope" on public.xaviar_evidence for select using (exists (select 1 from public.xaviar_recommendations r where r.id = recommendation_id and public.can_access_xaviar_subject(r.subject_user_id)));
create policy "xaviar feedback follows recommendation scope" on public.xaviar_feedback for select using (exists (select 1 from public.xaviar_recommendations r where r.id = recommendation_id and public.can_access_xaviar_subject(r.subject_user_id)));
create policy "xaviar predictions use subject scope" on public.xaviar_predictions for select using (public.can_access_xaviar_subject(subject_user_id));
create policy "xaviar plans use subject scope" on public.xaviar_coaching_plans for select using (public.can_access_xaviar_subject(subject_user_id));
create policy "xaviar release reviews are management only" on public.xaviar_release_reviews for select using (workspace_id = public.current_workspace_id() and public.current_role() in ('admin','manager'));

create or replace function public.record_xaviar_feedback(p_recommendation_id uuid, p_state public.xaviar_recommendation_state, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare target public.xaviar_recommendations;
begin
  select * into target from public.xaviar_recommendations where id = p_recommendation_id;
  if target.id is null or not public.can_access_xaviar_subject(target.subject_user_id) then raise exception 'Xaviar recommendation is not available.'; end if;
  if p_reason is not null and char_length(p_reason) > 1000 then raise exception 'Feedback reason is too long.'; end if;
  insert into public.xaviar_feedback(recommendation_id, actor_id, state, reason) values (target.id, auth.uid(), p_state, p_reason);
  update public.xaviar_recommendations set state = p_state, updated_at = now() where id = target.id;
  insert into public.audit_events(workspace_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (target.workspace_id, auth.uid(), 'xaviar_recommendation', target.id, 'xaviar_feedback_recorded', jsonb_build_object('state', target.state), jsonb_build_object('state', p_state, 'reason', p_reason));
end;
$$;

grant select on public.xaviar_performance_snapshots, public.xaviar_recommendations, public.xaviar_evidence, public.xaviar_feedback, public.xaviar_predictions, public.xaviar_coaching_plans, public.xaviar_release_reviews, public.xaviar_event_stream to authenticated;
grant execute on function public.can_access_xaviar_subject(uuid), public.record_xaviar_feedback(uuid, public.xaviar_recommendation_state, text) to authenticated;
