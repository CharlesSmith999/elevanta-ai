begin;
-- Empty prefix preserves the original connector's existing message ledger.
alter table public.gmail_connections add column message_prefix text not null default '';

create function public.gmail_replace_mailbox(p_workspace uuid,p_actor uuid,p_mailbox text,p_expected_revision uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_connection public.gmail_connections; v_mailbox text;
begin
 if not exists(select 1 from profiles where id=p_actor and workspace_id=p_workspace and role='admin' and active) then
  raise exception 'Active Admin required';
 end if;
 v_mailbox:=lower(trim(p_mailbox));
 if v_mailbox is null or length(v_mailbox)>254 or v_mailbox !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
  raise exception 'Invalid mailbox email';
 end if;
 select * into v_connection from gmail_connections where workspace_id=p_workspace for update;
 if not found then raise exception 'Save a mailbox first'; end if;
 if p_expected_revision is null or v_connection.settings_revision<>p_expected_revision then
  raise exception 'Mailbox settings changed. Refresh status and try again.';
 end if;
 if v_mailbox=v_connection.mailbox then raise exception 'Choose a different mailbox'; end if;
 update gmail_connections set mailbox=v_mailbox,settings_revision=gen_random_uuid(),
  message_prefix=gen_random_uuid()::text||':',encrypted_refresh_token=null,enabled=false,
  activated_at=null,scan_after=null,page_token=null,lease_id=null,lease_until=null,
  last_sync_at=null,last_error=null,connected_by=p_actor,updated_at=now()
 where workspace_id=p_workspace;
 delete from gmail_oauth_states where workspace_id=p_workspace;
 insert into audit_events(workspace_id,actor_id,entity_type,entity_id,action,after_json)
 values(p_workspace,p_actor,'gmail_connection',p_workspace,'gmail_mailbox_replaced',
  jsonb_build_object('intake_enabled',false,'fresh_consent_required',true));
end;
$$;
revoke all on function public.gmail_replace_mailbox(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.gmail_replace_mailbox(uuid,uuid,text,uuid) to service_role;
commit;
