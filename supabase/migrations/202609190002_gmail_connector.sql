begin;
create table public.gmail_connections (
 workspace_id uuid primary key references public.workspaces(id),
 mailbox text not null,
 encrypted_refresh_token text not null,
 enabled boolean not null default false,
 activated_at timestamptz,
 scan_after timestamptz,
 page_token text,
 lease_id uuid,
 lease_until timestamptz,
 last_sync_at timestamptz,
 last_error text,
 connected_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.gmail_oauth_states (
 state_hash text primary key,
 workspace_id uuid not null references public.workspaces(id),
 actor_id uuid not null references public.profiles(id),
 verifier_cipher text not null,
 expires_at timestamptz not null
);
alter table public.gmail_connections enable row level security;
alter table public.gmail_oauth_states enable row level security;
revoke all on public.gmail_connections,public.gmail_oauth_states from anon,authenticated;
grant select,insert,update,delete on public.gmail_connections,public.gmail_oauth_states to service_role;

create function public.gmail_claim_scan(p_workspace uuid,p_lease uuid) returns setof public.gmail_connections language sql security definer set search_path=public as $$
 update gmail_connections set lease_id=p_lease,lease_until=now()+interval '3 minutes'
 where workspace_id=p_workspace and enabled and activated_at is not null and (lease_until is null or lease_until<now())
 returning *;
$$;
create function public.gmail_record_message(p_workspace uuid,p_lease uuid,p_message_id text,p_thread_id text,p_received_at timestamptz,p_outcome text,p_payload jsonb,p_failure text)
returns void language plpgsql security definer set search_path=public as $$
declare v_message uuid; v_connection public.gmail_connections;
begin
 select * into v_connection from gmail_connections where workspace_id=p_workspace and enabled and lease_id=p_lease and lease_until>now() for update;
 if v_connection.workspace_id is null then raise exception 'Gmail scan lease expired'; end if;
 if p_received_at<v_connection.activated_at then return; end if;
 if p_outcome not in ('parsed','ignored','needs_review') or nullif(p_message_id,'') is null then raise exception 'Invalid ingestion outcome'; end if;
 insert into inbound_messages(workspace_id,provider_message_id,provider_thread_id,received_at,parser_version,processing_state,failure_code)
 values(p_workspace,p_message_id,p_thread_id,p_received_at,'bark-plain-v1',
 (case when p_outcome='parsed' then 'parsed' when p_outcome='ignored' then 'rejected' else 'needs_review' end)::inbound_processing_state,p_failure)
 on conflict(workspace_id,provider,provider_message_id) do nothing returning id into v_message;
 if v_message is null then return; end if;
 if p_outcome='parsed' then
  if nullif(trim(p_payload->>'name'),'') is null or p_payload->>'category' not in ('app','web','smm') then raise exception 'Invalid parsed lead'; end if;
  insert into inbound_lead_candidates(workspace_id,inbound_message_id,marketing_owner_id,original_payload,name,masked_phone,masked_email,address,lead_category,credits,description,details)
  values(p_workspace,v_message,null,p_payload,p_payload->>'name',p_payload->>'maskedPhone',p_payload->>'maskedEmail',p_payload->>'address',p_payload->>'category',(p_payload->>'credits')::integer,p_payload->>'description',p_payload->>'details');
 end if;
 insert into audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json)
 values(p_workspace,v_connection.connected_by,'inbound_message',v_message,'gmail_ingestion',jsonb_build_object('outcome',p_outcome,'parser_version','bark-plain-v1'));
end;
$$;
create function public.gmail_recorded_ids(p_workspace uuid,p_lease uuid,p_ids text[]) returns table(provider_message_id text) language sql security definer set search_path=public as $$
 select m.provider_message_id from inbound_messages m
 where m.workspace_id=p_workspace and m.provider_message_id=any(p_ids) and exists(select 1 from gmail_connections c where c.workspace_id=p_workspace and c.enabled and c.lease_id=p_lease and c.lease_until>now());
$$;
revoke all on function public.gmail_recorded_ids(uuid,uuid,text[]) from public,anon,authenticated;
grant execute on function public.gmail_recorded_ids(uuid,uuid,text[]) to service_role;
revoke all on function public.gmail_claim_scan(uuid,uuid),public.gmail_record_message(uuid,uuid,text,text,timestamptz,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gmail_claim_scan(uuid,uuid),public.gmail_record_message(uuid,uuid,text,text,timestamptz,text,jsonb,text) to service_role;
commit;
