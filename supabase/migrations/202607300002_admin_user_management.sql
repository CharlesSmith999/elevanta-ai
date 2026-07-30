-- Admin user-management support. Authentication records remain in auth.users;
-- this adds the department needed to enforce the approved manager hierarchy.
alter table public.profiles add column if not exists department text;
alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check
  check (department is null or department in ('marketing', 'sales'));

create index if not exists profiles_workspace_role_active_idx
  on public.profiles(workspace_id, role, active);

comment on column public.profiles.department is
  'Department for managers and individual contributors; admin profiles may leave this null.';
