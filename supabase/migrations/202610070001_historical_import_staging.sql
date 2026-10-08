-- v1.16: preserving history is separate from activating Sales work.
create table public.lead_import_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  workbook_name text not null check (length(workbook_name) between 1 and 255),
  expected_rows integer not null check (expected_rows between 1 and 100000),
  state text not null default 'uploading' check (state in ('uploading','staged')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  sealed_at timestamptz,
  unique (workspace_id, source_sha256)
);
create table public.lead_import_rows (
  batch_id uuid not null references public.lead_import_batches(id),
  record_id text not null check (record_id ~ '^R[0-9]{6}$'),
  group_id text not null,
  disposition text not null check (disposition in ('ready','review')),
  source_sheet text not null,
  source_row integer not null check (source_row > 0),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (batch_id, record_id),
  unique (batch_id, source_sheet, source_row)
);
create index lead_import_rows_review_idx on public.lead_import_rows(batch_id, disposition, group_id);
alter table public.lead_import_batches enable row level security;
alter table public.lead_import_rows enable row level security;
revoke all on public.lead_import_batches, public.lead_import_rows from anon, authenticated;
grant select on public.lead_import_batches, public.lead_import_rows to authenticated;
create policy import_batch_admin_read on public.lead_import_batches for select to authenticated
using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.active and p.role = 'admin' and p.workspace_id = lead_import_batches.workspace_id));
create policy import_row_admin_read on public.lead_import_rows for select to authenticated
using (exists(select 1 from public.lead_import_batches b join public.profiles p on p.workspace_id = b.workspace_id where b.id = lead_import_rows.batch_id and p.id = auth.uid() and p.active and p.role = 'admin'));

create function public.stage_historical_import(p_manifest jsonb, p_rows jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_workspace uuid; v_batch public.lead_import_batches%rowtype; v_row jsonb;
  v_existing jsonb; v_count integer; v_expected integer; v_added integer := 0;
begin
  select workspace_id into v_workspace from public.profiles where id = auth.uid() and active and role = 'admin';
  if v_workspace is null then raise exception 'Only an active Admin may import history'; end if;
  if p_manifest is null or jsonb_typeof(p_manifest) <> 'object'
     or p_manifest->>'format' is distinct from 'elevanta-history-v1'
     or coalesce(p_manifest->>'sourceSha256','') !~ '^[a-f0-9]{64}$'
     or coalesce(length(p_manifest->>'workbookName'),0) not between 1 and 255
     or coalesce(p_manifest->>'expectedRows','') !~ '^[0-9]+$'
  then raise exception 'Invalid import manifest'; end if;
  v_expected := (p_manifest->>'expectedRows')::integer;
  if v_expected not between 1 and 100000 then raise exception 'Invalid expected row count'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a row array'; end if;
  if jsonb_array_length(p_rows) not between 1 and 100 or octet_length(p_rows::text) > 1500000 then raise exception 'Upload chunk is too large'; end if;
  insert into public.lead_import_batches(workspace_id, source_sha256, workbook_name, expected_rows, created_by)
    values(v_workspace, p_manifest->>'sourceSha256', p_manifest->>'workbookName', v_expected, auth.uid())
    on conflict(workspace_id, source_sha256) do nothing;
  select * into v_batch from public.lead_import_batches where workspace_id = v_workspace and source_sha256 = p_manifest->>'sourceSha256' for update;
  if v_batch.expected_rows <> v_expected or v_batch.workbook_name <> p_manifest->>'workbookName' then raise exception 'Manifest differs from the existing batch'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object'
      or coalesce(v_row->>'recordId','') !~ '^R[0-9]{6}$'
      or coalesce(length(trim(v_row->>'groupId')),0) not between 1 and 80
      or coalesce(v_row->>'disposition','') not in ('ready','review')
      or coalesce(length(trim(v_row->>'sourceSheet')),0) not between 1 and 120
      or coalesce(v_row->>'sourceRow','') !~ '^[1-9][0-9]*$'
      or coalesce(length(trim(v_row->>'name')),0) not between 1 and 1000
      or jsonb_typeof(v_row->'phones') is distinct from 'array'
      or jsonb_typeof(v_row->'emails') is distinct from 'array'
      or jsonb_typeof(v_row->'values') is distinct from 'object'
      or jsonb_typeof(v_row->'sourceLinks') is distinct from 'array'
    then raise exception 'Invalid historical row'; end if;
    if jsonb_array_length(v_row->'sourceLinks') not between 1 and 100
      or jsonb_array_length(v_row->'phones') > 100 or jsonb_array_length(v_row->'emails') > 100
      or jsonb_array_length(v_row->'phones') + jsonb_array_length(v_row->'emails') = 0
    then raise exception 'Missing provenance or contact method'; end if;
    if exists(select 1 from jsonb_array_elements_text(v_row->'phones') t(value) where value !~ '^[0-9]{7,15}$' or value is null)
      or exists(select 1 from jsonb_array_elements_text(v_row->'emails') t(value) where value !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or value is null)
    then raise exception 'Invalid contact method'; end if;
    select payload into v_existing from public.lead_import_rows where batch_id = v_batch.id and record_id = v_row->>'recordId';
    if found then
      if v_existing <> v_row then raise exception 'Record differs from its previously staged version'; end if;
    else
      if v_batch.state <> 'uploading' then raise exception 'A sealed batch cannot be changed'; end if;
      insert into public.lead_import_rows(batch_id, record_id, group_id, disposition, source_sheet, source_row, payload)
      values(v_batch.id, v_row->>'recordId', v_row->>'groupId', v_row->>'disposition', v_row->>'sourceSheet', (v_row->>'sourceRow')::integer, v_row);
      v_added := v_added + 1;
    end if;
  end loop;
  select count(*) into v_count from public.lead_import_rows where batch_id = v_batch.id;
  if v_count > v_batch.expected_rows then raise exception 'Staged rows exceed the manifest'; end if;
  if v_added > 0 then
    insert into public.audit_events(workspace_id, actor_id, entity_type, entity_id, action, after_json)
    values(v_workspace, auth.uid(), 'lead_import_batch', v_batch.id, 'historical_rows_staged', jsonb_build_object('added',v_added,'total',v_count));
  end if;
  return v_batch.id;
end;
$$;

create function public.seal_historical_import(p_batch_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_batch public.lead_import_batches%rowtype; v_workspace uuid; v_count integer; v_ready integer; v_review integer;
begin
  select workspace_id into v_workspace from public.profiles where id = auth.uid() and active and role = 'admin';
  if v_workspace is null then raise exception 'Only an active Admin may validate an import'; end if;
  select * into v_batch from public.lead_import_batches where id = p_batch_id and workspace_id = v_workspace for update;
  if not found then raise exception 'Import batch not found'; end if;
  select count(*), count(*) filter(where disposition = 'ready'), count(*) filter(where disposition = 'review')
  into v_count, v_ready, v_review from public.lead_import_rows where batch_id = p_batch_id;
  if v_count <> v_batch.expected_rows then raise exception 'Upload incomplete: expected %, received %', v_batch.expected_rows, v_count; end if;
  if v_batch.state = 'uploading' then
    update public.lead_import_batches set state = 'staged', sealed_at = now() where id = p_batch_id;
    insert into public.audit_events(workspace_id, actor_id, entity_type, entity_id, action, after_json)
    values(v_workspace, auth.uid(), 'lead_import_batch', p_batch_id, 'historical_batch_sealed', jsonb_build_object('rows',v_count,'ready_candidates',v_ready,'review',v_review));
  end if;
  return jsonb_build_object('batchId',p_batch_id,'rows',v_count,'readyCandidates',v_ready,'review',v_review,'activated',0,'state','staged');
end;
$$;
revoke all on function public.stage_historical_import(jsonb,jsonb), public.seal_historical_import(uuid) from public, anon;
grant execute on function public.stage_historical_import(jsonb,jsonb), public.seal_historical_import(uuid) to authenticated;
