begin;
create type public.inbound_processing_state as enum ('received','parsed','needs_review','ready','published','rejected','failed');
create type public.lead_research_state as enum ('new','researching','found','not_found','connected','ready_for_sales','sent_to_sales','rejected');
create type public.inbound_duplicate_state as enum ('clear','possible','confirmed');

create table public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null default 'gmail',
  provider_message_id text not null,
  provider_thread_id text,
  received_at timestamptz not null,
  sender text,
  subject text,
  payload_hash text,
  parser_version text not null default 'fixture-v1',
  processing_state public.inbound_processing_state not null default 'received',
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, provider, provider_message_id)
);

create table public.inbound_lead_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inbound_message_id uuid not null unique references public.inbound_messages(id) on delete cascade,
  marketing_owner_id uuid not null references public.profiles(id),
  research_state public.lead_research_state not null default 'new',
  original_payload jsonb not null default '{}'::jsonb,
  name text not null,
  masked_phone text,
  masked_email text,
  address text,
  source text not null default 'Bark Stalk',
  lead_category text not null default 'not_available',
  credits integer,
  description text,
  details text,
  discovered_methods jsonb not null default '[]'::jsonb,
  evidence_links jsonb not null default '[]'::jsonb,
  research_notes text,
  duplicate_state public.inbound_duplicate_state not null default 'clear',
  published_opportunity_id uuid unique references public.opportunities(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbound_category_allowed check (lead_category in ('app','game','seo','smm','web','not_available')),
  constraint inbound_credits_nonnegative check (credits is null or credits >= 0),
  constraint inbound_publication_consistent check ((published_opportunity_id is null and published_at is null) or (published_opportunity_id is not null and published_at is not null))
);

create index inbound_candidates_workspace_state_idx on public.inbound_lead_candidates(workspace_id, research_state, created_at desc);
create index inbound_candidates_owner_idx on public.inbound_lead_candidates(marketing_owner_id, research_state);

alter table public.inbound_messages enable row level security;
alter table public.inbound_lead_candidates enable row level security;

create policy "inbound messages marketing scope" on public.inbound_messages for select using (
  workspace_id = public.current_workspace_id() and exists(select 1 from public.profiles where id=auth.uid() and active) and exists (
    select 1 from public.inbound_lead_candidates candidate
    where candidate.inbound_message_id = inbound_messages.id and (
      public.current_role() = 'admin' or candidate.marketing_owner_id = auth.uid() or
      exists(select 1 from public.profiles owner join public.profiles viewer on viewer.id=auth.uid() where owner.id=candidate.marketing_owner_id and owner.manager_id=auth.uid() and public.current_role()='manager' and viewer.department='marketing')
    )
  )
);

create policy "inbound candidates marketing scope" on public.inbound_lead_candidates for select using (
  workspace_id = public.current_workspace_id() and (
    public.current_role() = 'admin' or (public.current_role()='marketer' and marketing_owner_id = auth.uid()) or
    exists(select 1 from public.profiles owner join public.profiles viewer on viewer.id=auth.uid() where owner.id = marketing_owner_id and owner.manager_id = auth.uid() and public.current_role() = 'manager' and viewer.department='marketing')
  )
);

create or replace function public.create_inbound_candidate_v18(
  p_provider_message_id text, p_provider_thread_id text, p_received_at timestamptz,
  p_name text, p_masked_phone text, p_masked_email text, p_address text,
  p_source text, p_lead_category text, p_credits integer, p_description text,
  p_details text, p_marketing_owner_id uuid, p_original_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_message uuid;
  v_candidate uuid;
  v_owner uuid := coalesce(p_marketing_owner_id, auth.uid());
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and workspace_id=public.current_workspace_id() and (role in ('admin','marketer') or (role='manager' and department='marketing'))) then raise exception 'Active Marketing or Admin access required'; end if;
  if public.current_role() not in ('admin','marketer') then raise exception 'Only Admin and Marketing may add research leads'; end if;
  if nullif(trim(p_provider_message_id),'') is null or nullif(trim(p_name),'') is null then raise exception 'Message ID and lead name are required'; end if;
  if p_lead_category not in ('app','game','seo','smm','web','not_available') then raise exception 'Invalid lead category'; end if;
  if not exists(select 1 from public.profiles where id=v_owner and workspace_id=v_workspace and role='marketer' and active) then raise exception 'Research owner must be an active Marketing Agent'; end if;
  if public.current_role()='marketer' and v_owner<>auth.uid() then raise exception 'Marketing users may create only their own research items'; end if;

  insert into public.inbound_messages(workspace_id, provider_message_id, provider_thread_id, received_at, processing_state)
  values(v_workspace, trim(p_provider_message_id), nullif(trim(p_provider_thread_id),''), p_received_at, 'needs_review')
  on conflict(workspace_id, provider, provider_message_id) do update set updated_at=inbound_messages.updated_at
  returning id into v_message;

  select id into v_candidate from public.inbound_lead_candidates where inbound_message_id=v_message;
  if v_candidate is not null then
    if not exists(select 1 from public.inbound_lead_candidates where id=v_candidate and (public.current_role()='admin' or marketing_owner_id=auth.uid())) then raise exception 'Message already assigned to another researcher'; end if;
    return v_candidate;
  end if;

  insert into public.inbound_lead_candidates(workspace_id,inbound_message_id,marketing_owner_id,original_payload,name,masked_phone,masked_email,address,source,lead_category,credits,description,details)
  values(v_workspace,v_message,v_owner,coalesce(p_original_payload,'{}'::jsonb),trim(p_name),nullif(trim(p_masked_phone),''),nullif(trim(p_masked_email),''),nullif(trim(p_address),''),coalesce(nullif(trim(p_source),''),'Bark Stalk'),p_lead_category,p_credits,nullif(trim(p_description),''),nullif(trim(p_details),''))
  returning id into v_candidate;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json)
  values(v_workspace,auth.uid(),'inbound_lead_candidate',v_candidate,'research_item_created',jsonb_build_object('provider_message_id',trim(p_provider_message_id),'lead_category',p_lead_category));
  return v_candidate;
end;
$$;

create or replace function public.valid_research_method_v18(item jsonb) returns boolean language sql immutable set search_path=public as $$
  select coalesce(jsonb_typeof(item)='object' and length(item->>'value') between 1 and 254 and item->>'value' not like '%*%' and (
    (item->>'type'='email' and trim(item->>'value') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
    (item->>'type'='phone' and item->>'value' ~ '^[+0-9 ().-]+$' and length(regexp_replace(item->>'value','[^0-9]','','g')) between 7 and 15)
  ),false)
$$;

create or replace function public.update_inbound_candidate_v18(
  p_candidate_id uuid, p_research_state public.lead_research_state, p_name text,
  p_lead_category text, p_discovered_methods jsonb, p_evidence_links jsonb,
  p_research_notes text, p_duplicate_state public.inbound_duplicate_state
) returns void language plpgsql security definer set search_path = public as $$
declare v_candidate public.inbound_lead_candidates; v_ready boolean;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and workspace_id=public.current_workspace_id() and (role in ('admin','marketer') or (role='manager' and department='marketing'))) then raise exception 'Active Marketing or Admin access required'; end if;
  select * into v_candidate from public.inbound_lead_candidates where id=p_candidate_id and workspace_id=public.current_workspace_id() for update;
  if v_candidate.id is null then raise exception 'Research lead not found'; end if;
  if not (public.current_role()='admin' or v_candidate.marketing_owner_id=auth.uid() or exists(select 1 from public.profiles p join public.profiles viewer on viewer.id=auth.uid() where p.id=v_candidate.marketing_owner_id and p.manager_id=auth.uid() and public.current_role()='manager' and viewer.department='marketing')) then raise exception 'Research lead is outside your scope'; end if;
  if v_candidate.published_opportunity_id is not null then raise exception 'Published research leads cannot be edited'; end if;
  if p_research_state is null or p_research_state='sent_to_sales' then raise exception 'Use the publication action to send to Sales'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Lead name required'; end if;
  if p_lead_category not in ('app','game','seo','smm','web','not_available') then raise exception 'Invalid lead category'; end if;
  if p_discovered_methods is null or p_evidence_links is null or jsonb_typeof(p_discovered_methods)<>'array' or jsonb_typeof(p_evidence_links)<>'array' then raise exception 'Methods and evidence links must be lists'; end if;
  if jsonb_array_length(p_discovered_methods)>20 or jsonb_array_length(p_evidence_links)>20 then raise exception 'Maximum 20 methods and evidence links'; end if;
  if exists(select 1 from jsonb_array_elements(p_discovered_methods) item where not public.valid_research_method_v18(item)) then raise exception 'Invalid or masked contact method'; end if;
  if exists(select 1 from jsonb_array_elements_text(p_evidence_links) link where link !~ '^https?://[^/@[:space:]]+' or link ~ '^https?://[^/]*@') then raise exception 'Use HTTP or HTTPS evidence links without credentials'; end if;
  if jsonb_array_length(p_discovered_methods) <> (
    select count(distinct (item->>'type') || ':' || case when item->>'type'='phone' then regexp_replace(item->>'value','[^0-9]','','g') else lower(trim(item->>'value')) end) from jsonb_array_elements(p_discovered_methods) item
  ) then raise exception 'Duplicate contact methods are not allowed'; end if;
  v_ready := jsonb_array_length(p_discovered_methods)>0;
  if p_research_state='ready_for_sales' and (not v_ready or p_duplicate_state='confirmed') then raise exception 'A ready lead requires a usable contact method with no confirmed duplicate'; end if;
  update public.inbound_lead_candidates set research_state=p_research_state,name=trim(p_name),lead_category=p_lead_category,discovered_methods=p_discovered_methods,evidence_links=p_evidence_links,research_notes=nullif(trim(p_research_notes),''),duplicate_state=p_duplicate_state,updated_at=now() where id=p_candidate_id;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_candidate.workspace_id,auth.uid(),'inbound_lead_candidate',p_candidate_id,'research_item_updated',jsonb_build_object('research_state',p_research_state,'duplicate_state',p_duplicate_state));
end;
$$;

create or replace function public.create_research_opportunity_internal_v18(
  p_name text, p_phone text default null, p_email text default null, p_source text default null,
  p_marketing_owner_id uuid default null, p_sales_owner_id uuid default null, p_description text default null,
  p_lead_category text default 'not_available'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid := public.current_workspace_id();
  v_contact uuid;
  v_opportunity uuid;
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_existing_phone uuid;
  v_existing_email uuid;
  v_category text := coalesce(nullif(lower(trim(p_lead_category)), ''), 'not_available');
begin
  if not exists(select 1 from public.profiles viewer join public.profiles owner on owner.id=p_marketing_owner_id where viewer.id=auth.uid() and viewer.active and owner.active and owner.role='marketer' and owner.workspace_id=viewer.workspace_id and (viewer.role='admin' or viewer.id=owner.id or (viewer.role='manager' and viewer.department='marketing' and owner.manager_id=viewer.id))) then raise exception 'Marketing owner outside active viewer scope'; end if;
  if nullif(trim(p_name), '') is null or (v_phone is null and v_email is null) then raise exception 'A lead requires name plus phone or email'; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Provide a valid email'; end if;
  if v_phone is not null and length(v_phone) not between 7 and 15 then raise exception 'Provide a valid phone number'; end if;
  if v_category not in ('app','game','seo','smm','web','not_available') then raise exception 'Invalid lead category'; end if;
  if v_workspace is null then raise exception 'No workspace profile found'; end if;
  if public.current_role() = 'marketer' and coalesce(p_marketing_owner_id, auth.uid()) <> auth.uid() then raise exception 'Marketing users may create only their own leads'; end if;
  select contact_id into v_existing_phone from public.contact_methods where workspace_id = v_workspace and method_type = 'phone' and normalized_value = v_phone;
  select contact_id into v_existing_email from public.contact_methods where workspace_id = v_workspace and method_type = 'email' and normalized_value = v_email;
  if v_existing_phone is not null and v_existing_email is not null and v_existing_phone <> v_existing_email then raise exception 'Phone and email match different existing contacts; resolve the duplicate first'; end if;
  v_contact := coalesce(v_existing_phone, v_existing_email);
  if v_contact is null then
    insert into public.contacts(workspace_id, name, normalized_phone, normalized_email, source)
    values(v_workspace, trim(p_name), v_phone, v_email, nullif(trim(p_source), '')) returning id into v_contact;
  end if;
  insert into public.opportunities(workspace_id, contact_id, source, description, lead_category, marketing_owner_id, status)
  values(v_workspace, v_contact, nullif(trim(p_source), ''), nullif(trim(p_description), ''), v_category, coalesce(p_marketing_owner_id, auth.uid()), (case when p_sales_owner_id is null then 'new' else 'assigned' end)::public.opportunity_status)
  returning id into v_opportunity;
  if v_phone is not null then
    insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_by)
    values(v_workspace, v_contact, 'phone', trim(p_phone), v_phone, auth.uid())
    on conflict (workspace_id, method_type, normalized_value) do nothing;
  end if;
  if v_email is not null then
    insert into public.contact_methods(workspace_id, contact_id, method_type, value, normalized_value, created_by)
    values(v_workspace, v_contact, 'email', trim(p_email), v_email, auth.uid())
    on conflict (workspace_id, method_type, normalized_value) do nothing;
  end if;
  insert into public.opportunity_contact_methods(opportunity_id, contact_method_id, health, focus)
  select v_opportunity, cm.id,
    case when cm.globally_restricted then 'do_not_contact'::public.contact_method_health else 'unverified'::public.contact_method_health end,
    case when cm.globally_restricted then 'removed'::public.contact_method_focus else 'active'::public.contact_method_focus end
  from public.contact_methods cm
  where cm.contact_id = v_contact and (
    (v_phone is not null and cm.method_type = 'phone' and cm.normalized_value = v_phone)
    or (v_email is not null and cm.method_type = 'email' and cm.normalized_value = v_email)
  )
  on conflict (opportunity_id, contact_method_id) do nothing;
  if p_sales_owner_id is not null then
    if not exists(select 1 from public.profiles where id = p_sales_owner_id and workspace_id = v_workspace and role = 'sales_agent' and active) then raise exception 'Sales owner must be an active sales agent in this workspace'; end if;
    insert into public.assignments(opportunity_id, assigned_to, assigned_by, reason) values(v_opportunity, p_sales_owner_id, auth.uid(), 'Initial assignment');
  end if;
  insert into public.activities(opportunity_id, actor_id, type, body, metadata)
  values(v_opportunity, auth.uid(), 'created', 'Lead created', jsonb_build_object('lead_category', v_category, 'description_supplied', p_description is not null));
  return v_opportunity;
end;
$$;
revoke all on function public.create_research_opportunity_internal_v18(text,text,text,text,uuid,uuid,text,text) from public, anon, authenticated;

create or replace function public.publish_inbound_candidate_v18(p_candidate_id uuid,p_sales_owner_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_candidate public.inbound_lead_candidates; v_method jsonb; v_phone text; v_email text; v_opportunity uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and workspace_id=public.current_workspace_id() and (role in ('admin','marketer') or (role='manager' and department='marketing'))) then raise exception 'Active Marketing or Admin access required'; end if;
  select * into v_candidate from public.inbound_lead_candidates where id=p_candidate_id and workspace_id=public.current_workspace_id() for update;
  if v_candidate.id is null then raise exception 'Research lead not found'; end if;
  if not (public.current_role()='admin' or v_candidate.marketing_owner_id=auth.uid() or exists(select 1 from public.profiles p join public.profiles viewer on viewer.id=auth.uid() where p.id=v_candidate.marketing_owner_id and p.manager_id=auth.uid() and public.current_role()='manager' and viewer.department='marketing')) then raise exception 'Research lead is outside your scope'; end if;
  if v_candidate.published_opportunity_id is not null then return v_candidate.published_opportunity_id; end if;
  if v_candidate.research_state <> 'ready_for_sales' or v_candidate.duplicate_state='confirmed' then raise exception 'Research lead is not ready for Sales'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_candidate.workspace_id::text,0));
  if exists (
    select 1 from jsonb_array_elements(v_candidate.discovered_methods) method
    join public.contact_methods existing on existing.workspace_id=v_candidate.workspace_id
      and existing.method_type::text=method->>'type'
      and existing.normalized_value=case when method->>'type'='phone' then regexp_replace(method->>'value','[^0-9]','','g') else lower(trim(method->>'value')) end
  ) then raise exception 'A discovered contact already exists in the CRM. Review the duplicate before publication.'; end if;
  if not exists(select 1 from public.profiles where id=p_sales_owner_id and workspace_id=v_candidate.workspace_id and role='sales_agent' and active) then raise exception 'Sales owner must be active in this workspace'; end if;
  select item->>'value' into v_phone from jsonb_array_elements(v_candidate.discovered_methods) item where item->>'type'='phone' and item->>'value' not like '%*%' and length(regexp_replace(item->>'value','[^0-9]','','g')) between 7 and 15 limit 1;
  select item->>'value' into v_email from jsonb_array_elements(v_candidate.discovered_methods) item where item->>'type'='email' and item->>'value' not like '%*%' and item->>'value' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' limit 1;
  if v_phone is null and v_email is null then raise exception 'A usable phone or email is required'; end if;
  v_opportunity := public.create_research_opportunity_internal_v18(v_candidate.name,v_phone,v_email,v_candidate.source,v_candidate.marketing_owner_id,p_sales_owner_id,coalesce(v_candidate.description,v_candidate.details),v_candidate.lead_category);
  for v_method in select value from jsonb_array_elements(v_candidate.discovered_methods) loop
    if (v_method->>'value') not in (coalesce(v_phone,''),coalesce(v_email,'')) and (
      (v_method->>'type'='email' and v_method->>'value' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
      (v_method->>'type'='phone' and length(regexp_replace(v_method->>'value','[^0-9]','','g')) between 7 and 15)
    ) then perform public.add_opportunity_contact_method(v_opportunity,(v_method->>'type')::public.contact_method_type,v_method->>'value',coalesce(v_method->>'label','Research discovery')); end if;
  end loop;
  update public.contacts set source_external_id=(select provider_message_id from public.inbound_messages where id=v_candidate.inbound_message_id) where id=(select contact_id from public.opportunities where id=v_opportunity);
  update public.inbound_lead_candidates set research_state='sent_to_sales',published_opportunity_id=v_opportunity,published_at=now(),updated_at=now() where id=p_candidate_id;
  update public.inbound_messages set processing_state='published',updated_at=now() where id=v_candidate.inbound_message_id;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_candidate.workspace_id,auth.uid(),'inbound_lead_candidate',p_candidate_id,'research_item_published',jsonb_build_object('opportunity_id',v_opportunity,'sales_owner_id',p_sales_owner_id));
  return v_opportunity;
end;
$$;

grant select on public.inbound_messages, public.inbound_lead_candidates to authenticated;
grant execute on function public.create_inbound_candidate_v18(text,text,timestamptz,text,text,text,text,text,text,integer,text,text,uuid,jsonb), public.update_inbound_candidate_v18(uuid,public.lead_research_state,text,text,jsonb,jsonb,text,public.inbound_duplicate_state), public.publish_inbound_candidate_v18(uuid,uuid) to authenticated;

revoke insert, update, delete on public.inbound_messages, public.inbound_lead_candidates from authenticated, anon;
revoke execute on function public.create_inbound_candidate_v18(text,text,timestamptz,text,text,text,text,text,text,integer,text,text,uuid,jsonb), public.update_inbound_candidate_v18(uuid,public.lead_research_state,text,text,jsonb,jsonb,text,public.inbound_duplicate_state), public.publish_inbound_candidate_v18(uuid,uuid) from public, anon;
commit;
