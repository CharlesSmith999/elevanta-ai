create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'manager', 'sales_agent', 'marketer');
create type public.opportunity_status as enum ('new', 'assigned', 'contacted', 'connected', 'follow_up_required', 'qualified', 'proposal_sent', 'won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact');
create type public.assignment_visibility as enum ('full_context', 'fresh_start');
create type public.follow_up_status as enum ('open', 'completed', 'overdue', 'cancelled');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role public.app_role not null,
  manager_id uuid references public.profiles(id),
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint one_manager_per_user check (manager_id is null or manager_id <> id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  normalized_phone text,
  normalized_email text,
  source text,
  source_external_id text,
  do_not_contact boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_has_method check (normalized_phone is not null or normalized_email is not null)
);
create unique index contacts_workspace_phone_key on public.contacts(workspace_id, normalized_phone) where normalized_phone is not null;
create unique index contacts_workspace_email_key on public.contacts(workspace_id, normalized_email) where normalized_email is not null;

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  project_type text,
  description text,
  budget_band text,
  timeline_band text,
  source text,
  status public.opportunity_status not null default 'new',
  priority smallint not null default 0 check (priority between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index opportunities_workspace_status_idx on public.opportunities(workspace_id, status);
create index opportunities_contact_idx on public.opportunities(contact_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  assigned_to uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  visibility_mode public.assignment_visibility not null default 'full_context',
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index assignments_one_active_owner on public.assignments(opportunity_id) where ended_at is null;
create index assignments_active_owner_idx on public.assignments(assigned_to) where ended_at is null;

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  type text not null,
  body text,
  from_status public.opportunity_status,
  to_status public.opportunity_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activities_opportunity_created_idx on public.activities(opportunity_id, created_at desc);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  due_at timestamptz not null,
  action_type text not null,
  status public.follow_up_status not null default 'open',
  completed_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now()
);
create index follow_ups_owner_due_idx on public.follow_ups(owner_id, due_at) where status in ('open', 'overdue');

create table public.incorrect_reports (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason_code text not null,
  evidence text,
  created_at timestamptz not null default now(),
  unique(opportunity_id, reporter_id)
);

create table public.incorrect_reviews (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null unique references public.opportunities(id) on delete cascade,
  threshold_reached_at timestamptz not null default now(),
  reviewer_id uuid references public.profiles(id),
  decision text check (decision in ('confirmed_incorrect', 'rejected', 'merge_duplicate')),
  decision_reason text,
  decided_at timestamptz
);

create or replace function public.queue_incorrect_review_after_threshold() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.incorrect_reports where opportunity_id = new.opportunity_id) >= 3 then
    insert into public.incorrect_reviews (opportunity_id)
    values (new.opportunity_id)
    on conflict (opportunity_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger incorrect_report_threshold_reached
after insert on public.incorrect_reports
for each row execute function public.queue_incorrect_review_after_threshold();

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_workspace_id() returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.profiles where id = auth.uid()
$$;
create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;
create or replace function public.can_access_opportunity(target_opportunity_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.opportunities opportunity
    left join public.assignments assignment on assignment.opportunity_id = opportunity.id and assignment.ended_at is null
    left join public.profiles assignee on assignee.id = assignment.assigned_to
    where opportunity.id = target_opportunity_id
      and opportunity.workspace_id = public.current_workspace_id()
      and (
        public.current_role() in ('admin', 'marketer')
        or assignment.assigned_to = auth.uid()
        or (public.current_role() = 'manager' and assignee.manager_id = auth.uid())
      )
  )
$$;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.assignments enable row level security;
alter table public.activities enable row level security;
alter table public.follow_ups enable row level security;
alter table public.incorrect_reports enable row level security;
alter table public.incorrect_reviews enable row level security;
alter table public.audit_events enable row level security;

create policy "view own workspace" on public.workspaces for select using (id = public.current_workspace_id());
create policy "profiles in own workspace" on public.profiles for select using (workspace_id = public.current_workspace_id());
create policy "contacts limited to visible opportunities" on public.contacts for select using (
  workspace_id = public.current_workspace_id()
  and (
    public.current_role() in ('admin', 'marketer')
    or exists (select 1 from public.opportunities where contact_id = contacts.id and public.can_access_opportunity(opportunities.id))
  )
);
create policy "accessible opportunities" on public.opportunities for select using (public.can_access_opportunity(id));
create policy "accessible assignments" on public.assignments for select using (public.can_access_opportunity(opportunity_id));
create policy "accessible activities" on public.activities for select using (public.can_access_opportunity(opportunity_id));
create policy "accessible follow ups" on public.follow_ups for select using (public.can_access_opportunity(opportunity_id));
create policy "own incorrect reports" on public.incorrect_reports for select using (public.can_access_opportunity(opportunity_id));
create policy "review queue for admins" on public.incorrect_reviews for select using (public.current_role() = 'admin');
create policy "audit for admins" on public.audit_events for select using (public.current_role() = 'admin');
