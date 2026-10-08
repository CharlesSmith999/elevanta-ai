-- Activate only safe, sealed rows through the caller's authenticated Admin session.
-- The staging payload remains the immutable source of truth.
alter table public.opportunities
  add column if not exists historical_source_date date,
  add column if not exists historical_date_basis text,
  add column if not exists historical_import_batch_id uuid references public.lead_import_batches(id),
  add column if not exists historical_import_record_id text,
  add column if not exists historical_source_status text;

create unique index if not exists opportunities_historical_record_unique
  on public.opportunities(historical_import_batch_id, historical_import_record_id)
  where historical_import_batch_id is not null and historical_import_record_id is not null;
create index if not exists opportunities_historical_date_idx
  on public.opportunities(workspace_id, historical_source_date)
  where historical_source_date is not null;

create table public.lead_import_activations (
  batch_id uuid not null,
  record_id text not null,
  workspace_id uuid not null references public.workspaces(id),
  state text not null check (state in ('activated','review')),
  opportunity_id uuid references public.opportunities(id),
  reason text,
  decided_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (batch_id, record_id),
  foreign key (batch_id, record_id) references public.lead_import_rows(batch_id, record_id),
  check ((state = 'activated' and opportunity_id is not null and reason is null) or (state = 'review' and opportunity_id is null and reason is not null))
);
create index lead_import_activations_workspace_state_idx
  on public.lead_import_activations(workspace_id, state, created_at desc);
alter table public.lead_import_activations enable row level security;
revoke all on public.lead_import_activations from anon, authenticated;
grant select on public.lead_import_activations to authenticated;
create policy lead_import_activation_admin_read on public.lead_import_activations for select to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='admin' and p.workspace_id=lead_import_activations.workspace_id));

create or replace function public.activate_historical_import(p_batch_id uuid, p_owner_map jsonb, p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
  v_admin uuid := auth.uid();
  v_batch public.lead_import_batches%rowtype;
  v_row record;
  v_payload jsonb;
  v_values jsonb;
  v_status_raw text;
  v_status public.opportunity_status;
  v_qualification public.qualification_level := 'not_available';
  v_category text;
  v_date date;
  v_basis text;
  v_marketing uuid;
  v_sales uuid;
  v_contact uuid;
  v_opportunity uuid;
  v_phone text;
  v_email text;
  v_method jsonb;
  v_method_type public.contact_method_type;
  v_method_value text;
  v_method_norm text;
  v_activated integer := 0;
  v_review integer := 0;
  v_seen integer := 0;
  v_total_activated integer := 0;
  v_total_review integer := 0;
  v_reason text;
begin
  select workspace_id into v_workspace from public.profiles
    where id = v_admin and active and role = 'admin';
  if v_workspace is null then raise exception 'Only an active Admin may activate historical records'; end if;
  if p_limit not between 1 and 100 then raise exception 'Activation chunk must be between 1 and 100'; end if;
  if jsonb_typeof(p_owner_map) is distinct from 'object' then raise exception 'Explicit owner map is required'; end if;
  select * into v_batch from public.lead_import_batches
    where id = p_batch_id and workspace_id = v_workspace for update;
  if not found or v_batch.state <> 'staged' then raise exception 'A sealed import batch is required'; end if;

  for v_row in
    select r.record_id, r.group_id, r.disposition, r.payload
    from public.lead_import_rows r
    left join public.lead_import_activations a on a.batch_id = r.batch_id and a.record_id = r.record_id
    where r.batch_id = p_batch_id and r.disposition = 'ready' and a.record_id is null
    order by r.record_id limit p_limit for update of r
  loop
    v_seen := v_seen + 1;
    v_payload := v_row.payload;
    v_values := v_payload->'values';
    v_reason := null;
    v_status := null;
    v_qualification := 'not_available';
    v_date := null;
    v_basis := null;
    v_status_raw := nullif(btrim(v_values->>'Status'),'');
    v_status := null;
    v_category := case lower(btrim(coalesce(v_values->>'Category','')))
      when 'app' then 'app' when 'game' then 'game' when 'seo' then 'seo'
      when 'smm' then 'smm' when 'web' then 'web' else 'not_available' end;
    v_basis := nullif(btrim(v_values->>'Date Basis'),'');
    if coalesce(v_values->>'Source Date','') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_date := (v_values->>'Source Date')::date;
    else v_reason := 'Source date is absent or invalid'; end if;

    if lower(coalesce(v_status_raw,'')) = 'incorrect' then
      v_reason := 'Historical Incorrect requires Admin review; no independent CRM reports are fabricated';
    elsif lower(coalesce(v_status_raw,'')) in ('not available','') then v_status := 'not_available';
    elsif lower(v_status_raw) = 'no answer' then v_status := 'no_answer';
    elsif lower(v_status_raw) = 'connected' then v_status := 'connected';
    elsif lower(v_status_raw) in ('follow-up required','follow up required') then v_status := 'follow_up_required';
    elsif lower(v_status_raw) = 'won' then v_status := 'won';
    elsif lower(v_status_raw) = 'lost' then v_status := 'lost';
    elsif lower(v_status_raw) = 'not interested' then v_status := 'not_interested';
    elsif lower(v_status_raw) = 'proposal sent' then v_status := 'proposal_sent';
    elsif lower(v_status_raw) = 'mql' then v_status := 'qualified';
    else v_reason := coalesce(v_reason, 'Unsupported historical status requires Admin review'); end if;

    if lower(coalesce(v_values->>'MQL','')) = 'mql' and lower(coalesce(v_values->>'SQL','')) = 'sql' then
      v_reason := coalesce(v_reason, 'Conflicting historical MQL and SQL values require review');
    elsif lower(coalesce(v_values->>'SQL','')) = 'sql' then v_qualification := 'sql';
    elsif lower(coalesce(v_values->>'MQL','')) = 'mql' or lower(coalesce(v_status_raw,'')) = 'mql' then v_qualification := 'mql';
    else v_qualification := 'not_available'; end if;

    v_marketing := nullif(p_owner_map->'marketing'->>nullif(btrim(v_values->>'Marketing Source'),''),'')::uuid;
    v_sales := nullif(p_owner_map->'sales'->>nullif(btrim(v_values->>'Sales Owner'),''),'')::uuid;
    if v_marketing is null or v_sales is null then v_reason := coalesce(v_reason, 'Owner is not explicitly mapped'); end if;
    if v_status is null then v_reason := coalesce(v_reason, 'Unsupported historical status requires Admin review'); end if;

    if v_marketing is not null and not exists(select 1 from public.profiles p where p.id=v_marketing and p.workspace_id=v_workspace and p.active and (p.role='marketer' or (p.role='manager' and p.department='marketing'))) then
      v_reason := coalesce(v_reason, 'Marketing owner mapping is not an active Marketing user');
    end if;
    if v_sales is not null and not exists(select 1 from public.profiles p where p.id=v_sales and p.workspace_id=v_workspace and p.active and (p.role='sales_agent' or (p.role='manager' and p.department='sales'))) then
      v_reason := coalesce(v_reason, 'Sales owner mapping is not an active Sales user');
    end if;

    if v_reason is null then
      if exists(select 1 from public.lead_import_rows other
        where other.batch_id=p_batch_id and other.record_id<>v_row.record_id and other.disposition='ready'
          and (other.payload->'phones' ?| array(select jsonb_array_elements_text(v_payload->'phones'))
            or exists(select 1 from jsonb_array_elements_text(v_payload->'emails') e(value)
              where exists(select 1 from jsonb_array_elements_text(other.payload->'emails') oe(value) where lower(oe.value)=lower(e.value))))) then
        v_reason := 'Contact method also appears on another ready record; identity requires review';
      end if;
    end if;
    if v_reason is null then
      for v_method in select value from jsonb_array_elements(v_payload->'phones') value loop
        v_method_type := 'phone'; v_method_value := v_method#>>'{}'; v_method_norm := regexp_replace(v_method_value,'\D','','g');
        if exists(select 1 from public.contact_methods cm where cm.workspace_id=v_workspace and cm.method_type=v_method_type and cm.normalized_value=v_method_norm)
          or exists(select 1 from public.contacts c where c.workspace_id=v_workspace and c.normalized_phone=v_method_norm) then
          v_reason := 'Phone matches an existing CRM contact or restriction; review before activation'; exit;
        end if;
      end loop;
    end if;
    if v_reason is null then
      for v_method in select value from jsonb_array_elements(v_payload->'emails') value loop
        v_method_type := 'email'; v_method_value := v_method#>>'{}'; v_method_norm := lower(btrim(v_method_value));
        if exists(select 1 from public.contact_methods cm where cm.workspace_id=v_workspace and cm.method_type=v_method_type and cm.normalized_value=v_method_norm)
          or exists(select 1 from public.contacts c where c.workspace_id=v_workspace and c.normalized_email=v_method_norm) then
          v_reason := 'Email matches an existing CRM contact or restriction; review before activation'; exit;
        end if;
      end loop;
    end if;

    if v_reason is not null then
      insert into public.lead_import_activations(batch_id,record_id,workspace_id,state,reason,decided_by)
      values(p_batch_id,v_row.record_id,v_workspace,'review',v_reason,v_admin);
      v_review := v_review + 1;
      continue;
    end if;

    v_phone := case when jsonb_array_length(v_payload->'phones') > 0 then v_payload->'phones'->>0 end;
    v_email := case when jsonb_array_length(v_payload->'emails') > 0 then lower(v_payload->'emails'->>0) end;
    insert into public.contacts(workspace_id,name,normalized_phone,normalized_email,source)
      values(v_workspace,btrim(v_payload->>'name'),v_phone,v_email,'Other') returning id into v_contact;
    insert into public.opportunities(workspace_id,contact_id,source,status,qualification,lead_category,description,marketing_owner_id,
      historical_source_date,historical_date_basis,historical_import_batch_id,historical_import_record_id,historical_source_status)
      values(v_workspace,v_contact,'Other',v_status,v_qualification,v_category,nullif(v_values->>'Details',''),v_marketing,
        v_date,v_basis,p_batch_id,v_row.record_id,v_status_raw) returning id into v_opportunity;
    for v_method in select value from jsonb_array_elements(v_payload->'phones') value union all select value from jsonb_array_elements(v_payload->'emails') value loop
      if jsonb_typeof(v_method) = 'string' then
        v_method_value := v_method#>>'{}';
      else v_method_value := v_method->>'value'; end if;
      v_method_type := case when v_method_value ~ '^[0-9]+$' then 'phone' else 'email' end;
      v_method_norm := case when v_method_type='phone' then regexp_replace(v_method_value,'\D','','g') else lower(btrim(v_method_value)) end;
      insert into public.contact_methods(workspace_id,contact_id,method_type,value,normalized_value,created_by)
        values(v_workspace,v_contact,v_method_type,v_method_value,v_method_norm,v_admin)
        on conflict (workspace_id,method_type,normalized_value) do nothing;
      insert into public.opportunity_contact_methods(opportunity_id,contact_method_id,health,focus)
        select v_opportunity,id,'unverified','active' from public.contact_methods
        where workspace_id=v_workspace and contact_id=v_contact and method_type=v_method_type and normalized_value=v_method_norm
        on conflict (opportunity_id,contact_method_id) do nothing;
    end loop;
    insert into public.assignments(opportunity_id,assigned_to,assigned_by,visibility_mode,reason)
      values(v_opportunity,v_sales,v_admin,'full_context','Historical import assignment');
    insert into public.lead_import_activations(batch_id,record_id,workspace_id,state,opportunity_id,decided_by)
      values(p_batch_id,v_row.record_id,v_workspace,'activated',v_opportunity,v_admin);
    v_activated := v_activated + 1;
  end loop;

  if v_seen > 0 then
    insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json)
      values(v_workspace,v_admin,'lead_import_batch',p_batch_id,'historical_activation_chunk',jsonb_build_object('processed',v_seen,'activated',v_activated,'review',v_review));
  end if;
  select count(*) filter(where state='activated'), count(*) filter(where state='review')
    into v_total_activated, v_total_review from public.lead_import_activations where batch_id=p_batch_id;
  return jsonb_build_object('batchId',p_batch_id,'processed',v_seen,'activated',v_activated,'review',v_review,
    'activatedTotal',v_total_activated,'reviewTotal',v_total_review);
end;
$$;
revoke all on function public.activate_historical_import(uuid,jsonb,integer) from public, anon;
grant execute on function public.activate_historical_import(uuid,jsonb,integer) to authenticated;

-- Imported state is not a live CRM status-change event. Do not fabricate stage entry history.
create or replace function public.record_opportunity_stage_history() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  if tg_op = 'INSERT' then
    if new.historical_import_batch_id is not null then return new; end if;
    insert into public.opportunity_stage_history(opportunity_id,to_status,entered_at,changed_by,reason,metadata)
    values(new.id,new.status,new.created_at,auth.uid(),'Opportunity created',jsonb_build_object('event','created'))
    on conflict (opportunity_id) where exited_at is null do nothing;
    return new;
  end if;
  if new.status is distinct from old.status then
    update public.opportunity_stage_history set exited_at=v_now where opportunity_id=new.id and exited_at is null;
    insert into public.opportunity_stage_history(opportunity_id,from_status,to_status,entered_at,changed_by,reason,metadata)
    values(new.id,old.status,new.status,v_now,auth.uid(),'Status changed',jsonb_build_object('event','status_change','from_status',old.status,'to_status',new.status));
  end if;
  return new;
end;
$$;
