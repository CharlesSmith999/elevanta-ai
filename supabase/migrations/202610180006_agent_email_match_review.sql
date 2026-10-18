begin;

create table public.agent_email_match_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  message_id uuid not null references public.agent_email_messages(id) on delete cascade,
  reason text not null check (reason in ('no_exact_contact_match','manual_review')),
  candidate_emails jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','linked','ignored')),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id)
);

create index agent_email_match_reviews_queue_idx
  on public.agent_email_match_reviews(workspace_id, status, created_at desc);

alter table public.agent_email_match_reviews enable row level security;
revoke all on public.agent_email_match_reviews from anon, authenticated;
grant select, insert, update, delete on public.agent_email_match_reviews to service_role;

commit;
