-- Secret value is provisioned separately in Vault, never in migration/job text.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists gmail_private;
revoke all on schema gmail_private from public, anon, authenticated, service_role;
create table gmail_private.scheduler_state (
  singleton boolean primary key default true check (singleton),
  checked_at timestamptz,
  request_id bigint,
  requested_at timestamptz,
  last_http_status integer,
  last_http_checked_at timestamptz,
  state text not null default 'pending'
);
revoke all on gmail_private.scheduler_state from public, anon, authenticated, service_role;
insert into gmail_private.scheduler_state(singleton) values(true);

create function gmail_private.dispatch() returns void
language plpgsql security invoker set search_path = '' as $$
declare v_secret text; v_request bigint; v_previous bigint; v_status integer; v_timeout boolean; v_error text;
begin
  select request_id into v_previous from gmail_private.scheduler_state where singleton for update;
  if v_previous is not null then
    select status_code, timed_out, error_msg into v_status,v_timeout,v_error
      from net._http_response where id=v_previous;
    if found then
      update gmail_private.scheduler_state set last_http_status=v_status,last_http_checked_at=now(),
        state=case when v_status=200 and not coalesce(v_timeout,false) and v_error is null then 'delivered' else 'http_error' end
      where singleton;
    end if;
  end if;
  update gmail_private.scheduler_state set checked_at=now() where singleton;
  if not exists(select 1 from public.gmail_connections where enabled and encrypted_refresh_token is not null) then
    update gmail_private.scheduler_state set state='intake_disabled' where singleton;
    return;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='elevanta_gmail_cron_secret';
  if v_secret is null or length(v_secret)<32 then
    update gmail_private.scheduler_state set state='missing_secret' where singleton;
    return;
  end if;
  select net.http_get(
    url := 'https://elevanta-ai-pipeline.vercel.app/api/v1/internal/gmail/sync',
    headers := jsonb_build_object('Authorization','Bearer '||v_secret),
    timeout_milliseconds := 55000
  ) into v_request;
  update gmail_private.scheduler_state set request_id=v_request,requested_at=now() where singleton;
end;
$$;
revoke all on function gmail_private.dispatch() from public, anon, authenticated, service_role;

select cron.schedule('elevanta-gmail-minute','* * * * *','select gmail_private.dispatch();');
