-- Run as postgres against a workspace with an active Admin and Sales test user.
-- Every synthetic record is rolled back. No existing lead is edited.
begin;
do $test$
declare
  admin_id uuid;
  sales_id uuid;
  workspace uuid;
  assigned_id uuid;
  unassigned_id uuid;
  email_id uuid;
  phone_id uuid;
  rejected boolean := false;
begin
  select id, workspace_id into admin_id, workspace from public.profiles where role='admin' and active limit 1;
  select id into sales_id from public.profiles where role='sales_agent' and active and workspace_id=workspace limit 1;
  if admin_id is null or sales_id is null then raise exception 'Active Admin and Sales test users required'; end if;
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  assigned_id := public.create_opportunity_v17(p_name=>'QA rollback assigned',p_email=>gen_random_uuid()::text||'@example.com',p_source=>'Other',p_sales_owner_id=>sales_id,p_description=>'Synthetic rollback test',p_lead_category=>'web');
  if not exists(select 1 from public.opportunities where id=assigned_id and status='assigned' and description='Synthetic rollback test' and lead_category='web') then raise exception 'Assigned lead fields not preserved'; end if;
  if not exists(select 1 from public.assignments where opportunity_id=assigned_id and assigned_to=sales_id and ended_at is null) then raise exception 'Active assignment missing'; end if;
  if not exists(select 1 from public.opportunity_contact_methods where opportunity_id=assigned_id) then raise exception 'Email not linked'; end if;
  email_id := public.add_opportunity_contact_method(assigned_id,'email',gen_random_uuid()::text||'@example.com','QA extra email');
  phone_id := public.add_opportunity_contact_method(assigned_id,'phone','12025550199','QA fictional phone');
  if (select count(*) from public.opportunity_contact_methods where opportunity_id=assigned_id and contact_method_id in (email_id,phone_id) and health='unverified' and focus='active') <> 2 then raise exception 'Added phone/email health or focus incorrect'; end if;
  if (select count(*) from public.contact_method_events where opportunity_id=assigned_id and contact_method_id in (email_id,phone_id) and event_type='added') <> 2 then raise exception 'Added phone/email audit events missing'; end if;
  unassigned_id := public.create_opportunity_v17(p_name=>'QA rollback unassigned',p_email=>gen_random_uuid()::text||'@example.com',p_source=>'Other');
  if not exists(select 1 from public.opportunities where id=unassigned_id and status='new') then raise exception 'Unassigned status incorrect'; end if;
  begin
    perform public.create_opportunity_v17(p_name=>'QA invalid identity');
  exception when others then rejected := SQLERRM='A lead requires name plus phone or email'; end;
  if not rejected then raise exception 'Invalid identity was not correctly rejected'; end if;
  rejected := false;
  begin
    perform public.create_opportunity_v17(p_name=>'QA invalid owner',p_email=>gen_random_uuid()::text||'@example.com',p_sales_owner_id=>admin_id);
  exception when others then rejected := SQLERRM='Sales owner must be an active sales agent in this workspace'; end;
  if not rejected then raise exception 'Invalid sales owner was not correctly rejected'; end if;
  perform set_config('qa.assigned_id',assigned_id::text,true);
  perform set_config('qa.sales_id',sales_id::text,true);
end;
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.sales_id'),true);
do $test$
begin
  if not exists(select 1 from public.opportunities where id=current_setting('qa.assigned_id')::uuid) then raise exception 'Assigned Sales user cannot read the new lead under RLS'; end if;
end;
$test$;
rollback;
