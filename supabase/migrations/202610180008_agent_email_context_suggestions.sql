begin;

create table public.agent_email_context_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  message_id uuid not null references public.agent_email_messages(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  generator text not null check (generator in ('rules_v1','ai_v1')),
  model_version text not null,
  summary text not null,
  intent text not null,
  objections jsonb not null default '[]'::jsonb,
  suggested_next_action text not null,
  suggested_follow_up_at timestamptz,
  state text not null default 'pending' check (state in ('pending','accepted','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id)
);

create index agent_email_context_suggestions_opportunity_idx
  on public.agent_email_context_suggestions(workspace_id, opportunity_id, created_at desc);

alter table public.agent_email_context_suggestions enable row level security;
revoke all on public.agent_email_context_suggestions from anon, authenticated;
grant select, insert, update, delete on public.agent_email_context_suggestions to service_role;

commit;
