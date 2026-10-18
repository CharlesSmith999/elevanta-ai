begin;

-- Phase 1a: isolated, read-only Sales Agent Gmail synchronization foundation.
-- This is deliberately separate from gmail_connections, which serves central lead intake.

create table public.agent_gmail_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  profile_id uuid not null references public.profiles(id),
  mailbox text not null,
  encrypted_refresh_token text,
  granted_scopes text[] not null default '{}',
  status text not null default 'not_connected' check (status in ('not_connected','pending_consent','connected','paused','error','revoked')),
  enabled boolean not null default false,
  scan_after timestamptz,
  page_token text,
  lease_id uuid,
  lease_until timestamptz,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id),
  unique (workspace_id, mailbox)
);

create table public.agent_gmail_oauth_states (
  state_hash text primary key,
  workspace_id uuid not null references public.workspaces(id),
  profile_id uuid not null references public.profiles(id),
  mailbox text not null,
  verifier_cipher text not null,
  expires_at timestamptz not null
);

create table public.agent_email_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null references public.agent_gmail_connections(id) on delete cascade,
  provider_thread_id text not null,
  subject text,
  participants jsonb not null default '[]'::jsonb,
  first_message_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_thread_id)
);

create table public.agent_email_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null references public.agent_gmail_connections(id) on delete cascade,
  thread_id uuid not null references public.agent_email_threads(id) on delete cascade,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  sender text,
  recipients jsonb not null default '[]'::jsonb,
  subject text,
  occurred_at timestamptz not null,
  encrypted_body text,
  headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (connection_id, provider_message_id)
);

create table public.agent_email_message_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  message_id uuid not null references public.agent_email_messages(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 100),
  match_reason text not null,
  linked_by uuid references public.profiles(id),
  unlinked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, opportunity_id)
);

create table public.agent_email_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  connection_id uuid not null references public.agent_gmail_connections(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported_count integer not null default 0 check (imported_count >= 0),
  ignored_count integer not null default 0 check (ignored_count >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  failure_code text,
  created_at timestamptz not null default now()
);

create index agent_gmail_connections_workspace_status_idx
  on public.agent_gmail_connections(workspace_id, status, enabled);
create index agent_email_threads_workspace_last_message_idx
  on public.agent_email_threads(workspace_id, last_message_at desc);
create index agent_email_messages_workspace_occurred_idx
  on public.agent_email_messages(workspace_id, occurred_at desc);
create index agent_email_message_links_opportunity_idx
  on public.agent_email_message_links(workspace_id, opportunity_id, created_at desc)
  where unlinked_at is null;
create index agent_email_sync_runs_connection_started_idx
  on public.agent_email_sync_runs(connection_id, started_at desc);

alter table public.agent_gmail_connections enable row level security;
alter table public.agent_gmail_oauth_states enable row level security;
alter table public.agent_email_threads enable row level security;
alter table public.agent_email_messages enable row level security;
alter table public.agent_email_message_links enable row level security;
alter table public.agent_email_sync_runs enable row level security;

revoke all on public.agent_gmail_connections, public.agent_gmail_oauth_states,
  public.agent_email_threads, public.agent_email_messages,
  public.agent_email_message_links, public.agent_email_sync_runs
  from anon, authenticated;
grant select, insert, update, delete on public.agent_gmail_connections, public.agent_gmail_oauth_states,
  public.agent_email_threads, public.agent_email_messages,
  public.agent_email_message_links, public.agent_email_sync_runs to service_role;

commit;
