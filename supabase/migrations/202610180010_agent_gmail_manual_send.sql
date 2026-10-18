begin;

create table public.agent_email_sends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null references public.agent_gmail_connections(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  message_id uuid references public.agent_email_messages(id) on delete set null,
  provider_message_id text,
  to_email text not null,
  subject text not null,
  body_preview text not null default '',
  status text not null check (status in ('pending','sent','failed','blocked')),
  failure_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (connection_id, provider_message_id)
);

create index agent_email_sends_opportunity_idx on public.agent_email_sends(workspace_id, opportunity_id, created_at desc);
create index agent_email_sends_profile_idx on public.agent_email_sends(workspace_id, profile_id, created_at desc);

alter table public.agent_email_sends enable row level security;
revoke all on public.agent_email_sends from anon, authenticated;
grant select, insert, update on public.agent_email_sends to service_role;

commit;
