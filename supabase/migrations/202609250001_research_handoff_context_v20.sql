-- Research-to-Sales handoff context v2.0.
-- Preserves the useful Marketing summary for Sales without exposing masked
-- source values, provider identifiers, credits, or private evidence links.
begin;

alter table public.opportunities
  add column if not exists lead_address text,
  add column if not exists original_details text,
  add column if not exists research_summary text,
  add column if not exists source_received_at timestamptz,
  add column if not exists inbound_candidate_id uuid;

alter table public.opportunities
  drop constraint if exists opportunities_inbound_candidate_id_fkey;
alter table public.opportunities
  add constraint opportunities_inbound_candidate_id_fkey
  foreign key (inbound_candidate_id) references public.inbound_lead_candidates(id) on delete set null;

create index if not exists opportunities_inbound_candidate_id_idx
  on public.opportunities(inbound_candidate_id)
  where inbound_candidate_id is not null;

create or replace function public.publish_inbound_candidate_v18(p_candidate_id uuid,p_sales_owner_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare v_candidate public.inbound_lead_candidates; v_method jsonb; v_phone text; v_email text; v_opportunity uuid; v_received_at timestamptz;
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
  v_opportunity := public.create_research_opportunity_internal_v18(v_candidate.name,v_phone,v_email,v_candidate.source,v_candidate.marketing_owner_id,p_sales_owner_id,v_candidate.description,v_candidate.lead_category);
  select received_at into v_received_at from public.inbound_messages where id=v_candidate.inbound_message_id;
  update public.opportunities set
    lead_address = nullif(trim(v_candidate.address), ''),
    original_details = nullif(trim(v_candidate.details), ''),
    research_summary = nullif(trim(v_candidate.research_notes), ''),
    source_received_at = v_received_at,
    inbound_candidate_id = v_candidate.id
  where id = v_opportunity;
  for v_method in select value from jsonb_array_elements(v_candidate.discovered_methods) loop
    if (v_method->>'value') not in (coalesce(v_phone,''),coalesce(v_email,'')) and (
      (v_method->>'type'='email' and v_method->>'value' ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or
      (v_method->>'type'='phone' and length(regexp_replace(v_method->>'value','[^0-9]','','g')) between 7 and 15)
    ) then perform public.add_opportunity_contact_method(v_opportunity,(v_method->>'type')::public.contact_method_type,v_method->>'value',coalesce(v_method->>'label','Research discovery')); end if;
  end loop;
  update public.contacts set source_external_id=(select provider_message_id from public.inbound_messages where id=v_candidate.inbound_message_id) where id=(select contact_id from public.opportunities where id=v_opportunity);
  update public.inbound_lead_candidates set marketing_owner_id=v_candidate.marketing_owner_id,revision=revision+1,research_state='sent_to_sales',published_opportunity_id=v_opportunity,published_at=now(),updated_at=now() where id=p_candidate_id;
  update public.inbound_messages set processing_state='published',updated_at=now() where id=v_candidate.inbound_message_id;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_candidate.workspace_id,auth.uid(),'inbound_lead_candidate',p_candidate_id,'research_item_published',jsonb_build_object('opportunity_id',v_opportunity,'sales_owner_id',p_sales_owner_id,'shared_context',jsonb_build_array('address','description','original_details','research_summary','source_received_at')));
  return v_opportunity;
end;
$$;

-- v19 remains the only client-callable publication path because it enforces
-- the optimistic revision check before invoking this internal routine.
revoke all on function public.publish_inbound_candidate_v18(uuid,uuid) from public, anon, authenticated;
commit;
