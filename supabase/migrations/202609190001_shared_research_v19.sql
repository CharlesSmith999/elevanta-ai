begin;
alter table public.inbound_lead_candidates alter column marketing_owner_id drop not null;
alter table public.inbound_lead_candidates add column revision integer not null default 0;
create or replace function public.can_access_inbound_v19() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active and workspace_id=public.current_workspace_id() and (role in ('admin','marketer') or (role='manager' and department='marketing')))
$$;
revoke all on function public.can_access_inbound_v19() from public,anon;
grant execute on function public.can_access_inbound_v19() to authenticated;
alter policy "inbound candidates marketing scope" on public.inbound_lead_candidates using (workspace_id=public.current_workspace_id() and public.can_access_inbound_v19());
alter policy "inbound messages marketing scope" on public.inbound_messages using (workspace_id=public.current_workspace_id() and public.can_access_inbound_v19());
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
  update public.inbound_lead_candidates set research_state=p_research_state,name=trim(p_name),lead_category=p_lead_category,discovered_methods=p_discovered_methods,evidence_links=p_evidence_links,research_notes=nullif(trim(p_research_notes),''),duplicate_state=p_duplicate_state,marketing_owner_id=case when public.current_role()='marketer' then auth.uid() else marketing_owner_id end,revision=revision+1,updated_at=now() where id=p_candidate_id;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_candidate.workspace_id,auth.uid(),'inbound_lead_candidate',p_candidate_id,'research_item_updated',jsonb_build_object('research_state',p_research_state,'duplicate_state',p_duplicate_state));
end;
$$;


create or replace function public.publish_inbound_candidate_v18(p_candidate_id uuid,p_sales_owner_id uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_candidate public.inbound_lead_candidates; v_method jsonb; v_phone text; v_email text; v_opportunity uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and workspace_id=public.current_workspace_id() and (role in ('admin','marketer') or (role='manager' and department='marketing'))) then raise exception 'Active Marketing or Admin access required'; end if;
  select * into v_candidate from public.inbound_lead_candidates where id=p_candidate_id and workspace_id=public.current_workspace_id() for update;
  if v_candidate.id is null then raise exception 'Research lead not found'; end if;

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
  if public.current_role()='marketer' then v_candidate.marketing_owner_id := auth.uid(); end if;
  v_opportunity := public.create_research_opportunity_internal_v18(v_candidate.name,v_phone,v_email,v_candidate.source,v_candidate.marketing_owner_id,p_sales_owner_id,coalesce(v_candidate.description,v_candidate.details),v_candidate.lead_category);
  for v_method in select value from jsonb_array_elements(v_candidate.discovered_methods) loop
    if (v_method->>'value') not in (coalesce(v_phone,''),coalesce(v_email,'')) and (
      (v_method->>'type'='email' and v_method->>'value' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
      (v_method->>'type'='phone' and length(regexp_replace(v_method->>'value','[^0-9]','','g')) between 7 and 15)
    ) then perform public.add_opportunity_contact_method(v_opportunity,(v_method->>'type')::public.contact_method_type,v_method->>'value',coalesce(v_method->>'label','Research discovery')); end if;
  end loop;
  update public.contacts set source_external_id=(select provider_message_id from public.inbound_messages where id=v_candidate.inbound_message_id) where id=(select contact_id from public.opportunities where id=v_opportunity);
  update public.inbound_lead_candidates set marketing_owner_id=v_candidate.marketing_owner_id,revision=revision+1,research_state='sent_to_sales',published_opportunity_id=v_opportunity,published_at=now(),updated_at=now() where id=p_candidate_id;
  update public.inbound_messages set processing_state='published',updated_at=now() where id=v_candidate.inbound_message_id;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_candidate.workspace_id,auth.uid(),'inbound_lead_candidate',p_candidate_id,'research_item_published',jsonb_build_object('opportunity_id',v_opportunity,'sales_owner_id',p_sales_owner_id));
  return v_opportunity;
end;
$$;
create or replace function public.update_inbound_candidate_v19(
 p_candidate_id uuid,p_research_state public.lead_research_state,p_name text,p_lead_category text,
 p_discovered_methods jsonb,p_evidence_links jsonb,p_research_notes text,p_duplicate_state public.inbound_duplicate_state,p_expected_revision integer
) returns void language plpgsql security definer set search_path=public as $$
declare v_revision integer;
begin
 if not public.can_access_inbound_v19() then raise exception 'Active Marketing or Admin access required'; end if;
 select revision into v_revision from inbound_lead_candidates where id=p_candidate_id and workspace_id=public.current_workspace_id() for update;
 if v_revision is null then raise exception 'Research lead not found'; end if;
 if p_expected_revision is null or v_revision<>p_expected_revision then raise exception 'This lead was changed by another user. Reload before saving.'; end if;
 perform public.update_inbound_candidate_v18(p_candidate_id,p_research_state,p_name,p_lead_category,p_discovered_methods,p_evidence_links,p_research_notes,p_duplicate_state);
end;
$$;
create or replace function public.publish_inbound_candidate_v19(p_candidate_id uuid,p_sales_owner_id uuid,p_expected_revision integer) returns uuid language plpgsql security definer set search_path=public as $$
declare v_candidate public.inbound_lead_candidates;
begin
 if not public.can_access_inbound_v19() then raise exception 'Active Marketing or Admin access required'; end if;
 select * into v_candidate from inbound_lead_candidates where id=p_candidate_id and workspace_id=public.current_workspace_id() for update;
 if v_candidate.id is null then raise exception 'Research lead not found'; end if;
 if v_candidate.published_opportunity_id is not null then return v_candidate.published_opportunity_id; end if;
 if p_expected_revision is null or v_candidate.revision<>p_expected_revision then raise exception 'This lead was changed by another user. Reload before sending.'; end if;
 return public.publish_inbound_candidate_v18(p_candidate_id,p_sales_owner_id);
end;
$$;
revoke execute on function public.update_inbound_candidate_v18(uuid,public.lead_research_state,text,text,jsonb,jsonb,text,public.inbound_duplicate_state),public.publish_inbound_candidate_v18(uuid,uuid) from authenticated;
revoke all on function public.update_inbound_candidate_v19(uuid,public.lead_research_state,text,text,jsonb,jsonb,text,public.inbound_duplicate_state,integer),public.publish_inbound_candidate_v19(uuid,uuid,integer) from public,anon;
grant execute on function public.update_inbound_candidate_v19(uuid,public.lead_research_state,text,text,jsonb,jsonb,text,public.inbound_duplicate_state,integer),public.publish_inbound_candidate_v19(uuid,uuid,integer) to authenticated;
commit;
