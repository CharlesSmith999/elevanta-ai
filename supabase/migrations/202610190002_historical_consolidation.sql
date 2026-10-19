-- One-time historical consolidation executor.
-- It is intentionally separate from normal duplicate handling and is scoped to
-- one sealed historical batch. Every source row is retained in the ledger.

create or replace function public.consolidate_historical_import(
  p_batch_id uuid,
  p_limit integer default 100
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid;
  v_admin uuid := auth.uid();
  v_group record;
  v_row record;
  v_group_ledger uuid;
  v_canonical uuid;
  v_contact uuid;
  v_status public.opportunity_status;
  v_owner uuid;
  v_old_owner uuid;
  v_reason text;
  v_group_count integer := 0;
  v_merged integer := 0;
  v_review integer := 0;
  v_evidence integer := 0;
  v_source_date date;
begin
  select workspace_id into v_workspace from public.profiles
    where id = v_admin and active and role = 'admin';
  if v_workspace is null then raise exception 'Only an active Admin may consolidate historical records'; end if;
  if p_limit not between 1 and 100 then raise exception 'Consolidation chunk must be between 1 and 100'; end if;
  if not exists (select 1 from public.lead_import_batches where id=p_batch_id and workspace_id=v_workspace and state='staged') then
    raise exception 'A sealed historical import batch is required';
  end if;

  for v_group in
    select r.group_id
    from public.lead_import_rows r
    left join public.historical_merge_groups g on g.batch_id=r.batch_id and g.group_id=r.group_id
    where r.batch_id=p_batch_id and g.id is null
    group by r.group_id
    order by r.group_id
    limit p_limit
  loop
    v_group_count := v_group_count + 1;
    v_canonical := null; v_owner := null; v_reason := null; v_status := null; v_source_date := null;

    select o.id into v_canonical
    from public.opportunities o
    join public.lead_import_rows r on r.batch_id=o.historical_import_batch_id and r.record_id=o.historical_import_record_id
    where r.batch_id=p_batch_id and r.group_id=v_group.group_id
    order by o.created_at, o.id limit 1;

    if (select count(*) from public.opportunities o join public.lead_import_rows r on r.batch_id=o.historical_import_batch_id and r.record_id=o.historical_import_record_id where r.batch_id=p_batch_id and r.group_id=v_group.group_id) > 1 then
      v_reason := 'Multiple existing CRM opportunities matched this historical group';
    end if;

    select x.source_date, x.status into v_source_date, v_status
    from (
      select nullif(left(r.payload->'values'->>'Source Date',10),'')::date source_date,
        case lower(coalesce(r.payload->'values'->>'Status',''))
          when 'not available' then 'not_available'::public.opportunity_status
          when 'no answer' then 'no_answer'::public.opportunity_status
          when 'connected' then 'connected'::public.opportunity_status
          when 'follow-up required' then 'follow_up_required'::public.opportunity_status
          when 'won' then 'won'::public.opportunity_status
          when 'lost' then 'lost'::public.opportunity_status
          when 'not interested' then 'not_interested'::public.opportunity_status
          when 'proposal sent' then 'proposal_sent'::public.opportunity_status
          when 'mql' then 'qualified'::public.opportunity_status
          when 'contacted' then 'contacted'::public.opportunity_status
          else null end status,
        r.source_row
      from public.lead_import_rows r
      where r.batch_id=p_batch_id and r.group_id=v_group.group_id
      order by nullif(left(r.payload->'values'->>'Source Date',10),'')::date desc nulls last, r.source_row desc
      limit 1
    ) x;

    if v_canonical is null and v_reason is null then
      -- Review rows may match a contact already activated from the same
      -- historical batch or an older CRM record. Reuse that identity rather
      -- than attempting a second contact insert.
      select c.id into v_contact
      from public.contacts c
      join public.lead_import_rows r on r.batch_id=p_batch_id and r.group_id=v_group.group_id
      where c.workspace_id=v_workspace
        and ((nullif(r.payload->'phones'->>0,'') is not null and c.normalized_phone=nullif(r.payload->'phones'->>0,''))
          or (nullif(r.payload->'emails'->>0,'') is not null and c.normalized_email=lower(nullif(r.payload->'emails'->>0,''))))
      order by c.created_at, c.id limit 1;
      if v_contact is not null then
        select o.id into v_canonical from public.opportunities o where o.workspace_id=v_workspace and o.contact_id=v_contact order by o.created_at, o.id limit 1;
      end if;
    end if;
    if v_canonical is null and v_reason is null then
      insert into public.contacts(workspace_id,name,normalized_phone,normalized_email,source)
      select v_workspace, r.payload->>'name', nullif(r.payload->'phones'->>0,''), lower(nullif(r.payload->'emails'->>0,'')), 'Other'
      from public.lead_import_rows r where r.batch_id=p_batch_id and r.group_id=v_group.group_id order by r.source_row limit 1
      on conflict (workspace_id, normalized_phone) where normalized_phone is not null do update set name=excluded.name
      returning id into v_contact;
      if v_contact is null then
        select c.id into v_contact from public.contacts c join public.lead_import_rows r on r.payload->'phones'->>0=c.normalized_phone where r.batch_id=p_batch_id and r.group_id=v_group.group_id limit 1;
      end if;
      insert into public.opportunities(workspace_id,contact_id,source,status,qualification,lead_category,description,marketing_owner_id)
      values(v_workspace,v_contact,'Other',coalesce(v_status,'not_available'::public.opportunity_status),'not_available','not_available','Historical consolidation',null)
      returning id into v_canonical;
    end if;

    if v_reason is null then
      select p.id into v_owner
      from public.lead_import_rows r join public.profiles p on lower(trim(p.full_name))=lower(trim(r.payload->'values'->>'Sales Owner'))
      where r.batch_id=p_batch_id and r.group_id=v_group.group_id and p.workspace_id=v_workspace and p.active and p.department='sales'
      order by nullif(left(r.payload->'values'->>'Source Date',10),'')::date desc nulls last, r.source_row desc limit 1;
      if v_owner is null then v_reason := 'Latest Sales owner could not be resolved'; end if;
    end if;

    insert into public.historical_merge_groups(workspace_id,batch_id,group_id,canonical_opportunity_id,state,current_sales_owner_id,review_reason,decided_by,decided_at)
    values(v_workspace,p_batch_id,v_group.group_id,v_canonical,case when v_reason is null then 'merged' else 'review' end,v_owner,v_reason,v_admin,now())
    returning id into v_group_ledger;

    for v_row in select r.* from public.lead_import_rows r where r.batch_id=p_batch_id and r.group_id=v_group.group_id order by r.source_row loop
      insert into public.historical_merge_status_evidence(merge_group_id,batch_id,source_record_id,source_sheet,source_row,source_date,raw_status,normalized_status,sales_owner_id,source_payload)
      values(v_group_ledger,p_batch_id,v_row.record_id,v_row.source_sheet,v_row.source_row,nullif(left(v_row.payload->'values'->>'Source Date',10),'')::date,v_row.payload->'values'->>'Status',
        case lower(coalesce(v_row.payload->'values'->>'Status','')) when 'not available' then 'not_available' when 'no answer' then 'no_answer' when 'connected' then 'connected' when 'follow-up required' then 'follow_up_required' when 'won' then 'won' when 'lost' then 'lost' when 'not interested' then 'not_interested' when 'proposal sent' then 'proposal_sent' when 'mql' then 'qualified' when 'contacted' then 'contacted' else null end::public.opportunity_status,
        (select p.id from public.profiles p where p.workspace_id=v_workspace and lower(trim(p.full_name))=lower(trim(v_row.payload->'values'->>'Sales Owner')) and p.active limit 1),v_row.payload)
      on conflict (batch_id,source_record_id) do nothing;
      v_evidence := v_evidence + 1;
      if v_reason is null and (v_row.payload->'values'->>'Status') is not null and lower(v_row.payload->'values'->>'Status') not in ('not available','no answer') then
        insert into public.activities(opportunity_id,actor_id,type,body,to_status,metadata,created_at)
        values(v_canonical,v_admin,'historical_status','Imported historical status: '||(v_row.payload->'values'->>'Status'),
          (select normalized_status from public.historical_merge_status_evidence where batch_id=p_batch_id and source_record_id=v_row.record_id),jsonb_build_object('sourceSheet',v_row.source_sheet,'sourceRow',v_row.source_row,'sourceRecordId',v_row.record_id),coalesce(nullif(left(v_row.payload->'values'->>'Source Date',10),'')::date::timestamptz,now()));
      end if;
    end loop;
    update public.historical_merge_groups set source_row_count=(select count(*) from public.lead_import_rows where batch_id=p_batch_id and group_id=v_group.group_id), status_evidence_count=(select count(*) from public.historical_merge_status_evidence where merge_group_id=v_group_ledger), updated_at=now() where id=v_group_ledger;
    if v_reason is null then
      select assigned_to into v_old_owner from public.assignments where opportunity_id=v_canonical and ended_at is null limit 1;
      if v_old_owner is distinct from v_owner then
        update public.assignments set ended_at=now() where opportunity_id=v_canonical and ended_at is null;
        insert into public.assignments(opportunity_id,assigned_to,assigned_by,visibility_mode,reason) values(v_canonical,v_owner,v_admin,'full_context','Historical consolidation current owner');
      end if;
      update public.opportunities set status=coalesce(v_status,status), updated_at=now() where id=v_canonical;
      v_merged := v_merged + 1;
    else v_review := v_review + 1; end if;
  end loop;
  insert into public.audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json) values(v_workspace,v_admin,'lead_import_batch',p_batch_id,'historical_consolidation_chunk',jsonb_build_object('groups',v_group_count,'merged',v_merged,'review',v_review,'evidence',v_evidence));
  return jsonb_build_object('groups',v_group_count,'merged',v_merged,'review',v_review,'evidence',v_evidence);
end;
$$;

revoke all on function public.consolidate_historical_import(uuid,integer) from public, anon;
grant execute on function public.consolidate_historical_import(uuid,integer) to authenticated;
