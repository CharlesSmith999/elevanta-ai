import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createGmailReader, GmailReadError, parseBarkMessage } from './gmailIntake.js';

const scope = 'https://www.googleapis.com/auth/gmail.readonly';
export const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export function gmailConfig(env = process.env) {
  const names = ['GOOGLE_GMAIL_CLIENT_ID','GOOGLE_GMAIL_CLIENT_SECRET','GMAIL_REDIRECT_URI','GMAIL_EXPECTED_MAILBOX','GMAIL_TOKEN_KEY'] as const;
  if (names.some(name => !env[name])) throw new Error('Gmail connection configuration is incomplete.');
  const redirect = new URL(env.GMAIL_REDIRECT_URI!);
  if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.search || redirect.hash || redirect.pathname !== '/api/v1/inbound/gmail/callback') throw new Error('Invalid Gmail callback configuration.');
  const key = Buffer.from(env.GMAIL_TOKEN_KEY!, 'base64');
  if (key.length !== 32) throw new Error('Invalid Gmail encryption configuration.');
  return { clientId: env.GOOGLE_GMAIL_CLIENT_ID!, clientSecret: env.GOOGLE_GMAIL_CLIENT_SECRET!, redirect: redirect.href, mailbox: env.GMAIL_EXPECTED_MAILBOX!.trim().toLowerCase(), key };
}
export function seal(value: string, key: Buffer, context: string) {
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(b => b.toString('base64url')).join('.');
}
export function unseal(value: string, key: Buffer, context: string) {
  const [iv, tag, body] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(body), cipher.final()]).toString('utf8');
}
export function validSchedulerSecret(actual: string | undefined, expected: string | undefined) {
  if (!expected || expected.length < 32 || !actual) return false;
  const a = Buffer.from(actual), b = Buffer.from(`Bearer ${expected}`); return a.length === b.length && timingSafeEqual(a,b);
}
async function tokenRequest(fields: Record<string,string>) {
  const config = gmailConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new GmailReadError(response.status === 400 || response.status === 401 ? 'authorization' : 'temporary');
  const value = await response.json();
  if (typeof value.access_token !== 'string') throw new GmailReadError('invalid_response');
  return value as { access_token: string; refresh_token?: string; scope?: string };
}
function check(error: unknown) { if (error) throw new Error('Gmail database operation failed.'); }
export async function startGmailConnection(db: SupabaseClient, workspace: string, actor: string) {
  const config = gmailConfig(); const state = randomBytes(32).toString('base64url'); const verifier = randomBytes(48).toString('base64url');
  const { error } = await db.from('gmail_oauth_states').insert({ state_hash: digest(state), workspace_id: workspace, actor_id: actor, verifier_cipher: seal(verifier, config.key, workspace), expires_at: new Date(Date.now()+600000).toISOString() }); check(error);
  const query = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirect, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', login_hint: config.mailbox, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, state };
}
export async function finishGmailConnection(db: SupabaseClient, state: string, cookie: string, code: string) {
  if (!state || state.length > 128 || !cookie || digest(state) !== digest(cookie) || !code || code.length > 4096) throw new Error('Gmail authorization expired. Start again.');
  const { data, error } = await db.from('gmail_oauth_states').delete().eq('state_hash', digest(state)).gt('expires_at', new Date().toISOString()).select('*').maybeSingle(); check(error);
  if (!data) throw new Error('Gmail authorization expired. Start again.');
  const { data: actor, error: actorError } = await db.from('profiles').select('id').eq('id', data.actor_id).eq('workspace_id', data.workspace_id).eq('role','admin').eq('active',true).maybeSingle(); check(actorError);
  if (!actor) throw new Error('Active Admin authorization required.');
  const config = gmailConfig();
  const tokens = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: config.redirect, code_verifier: unseal(data.verifier_cipher, config.key, data.workspace_id) });
  if (!tokens.refresh_token || !tokens.scope?.split(' ').includes(scope)) throw new Error('Read-only Gmail consent was not completed.');
  await createGmailReader(tokens.access_token).verifyMailbox(config.mailbox);
  const { error: saveError } = await db.from('gmail_connections').upsert({ workspace_id: data.workspace_id, mailbox: config.mailbox, encrypted_refresh_token: seal(tokens.refresh_token,config.key,data.workspace_id), enabled:false, activated_at:null, scan_after:null, page_token:null, lease_id:null, lease_until:null, last_error:null, connected_by:data.actor_id, updated_at:new Date().toISOString() }); check(saveError);
}
export async function gmailHealth(db: SupabaseClient, workspace: string) {
  const { data, error } = await db.from('gmail_connections').select('enabled,activated_at,last_sync_at,last_error').eq('workspace_id',workspace).maybeSingle(); check(error);
  return { connected: Boolean(data), enabled: data?.enabled ?? false, activatedAt:data?.activated_at, lastSyncAt:data?.last_sync_at, lastError:data?.last_error, activationApproved: process.env.GMAIL_LIVE_APPROVED === 'true' };
}
export async function setGmailEnabled(db: SupabaseClient, workspace: string, enabled: boolean) {
  if (enabled && process.env.GMAIL_LIVE_APPROVED !== 'true') throw new Error('Gmail activation requires the documented release approvals.');
  const now = new Date().toISOString();
  const { data, error } = await db.from('gmail_connections').update({ enabled, lease_id:null,lease_until:null,page_token:null, ...(enabled ? { activated_at:now,scan_after:now } : {}), updated_at:now }).eq('workspace_id',workspace).eq('enabled',!enabled).select('workspace_id'); check(error);
  if (!data?.length) throw new Error('Connect Gmail first, or refresh the connection status.');
}
export async function syncGmail(db: SupabaseClient, workspace: string) {
  if (process.env.GMAIL_LIVE_APPROVED !== 'true') return {state:'approval_required',processed:0};
  const lease = randomUUID(); const { data, error } = await db.rpc('gmail_claim_scan',{p_workspace:workspace,p_lease:lease}); check(error);
  const connection = data?.[0]; if (!connection) return { state:'idle', processed:0 };
  const started = Date.now(); let processed = 0;
  try {
    const config = gmailConfig(); if (connection.mailbox !== config.mailbox) throw new GmailReadError('authorization');
    const tokens = await tokenRequest({ grant_type:'refresh_token', refresh_token:unseal(connection.encrypted_refresh_token,config.key,workspace) });
    const reader = createGmailReader(tokens.access_token); await reader.verifyMailbox(config.mailbox);
    const page = await reader.list(connection.scan_after ?? connection.activated_at, connection.page_token ?? undefined);
    const {data:recorded,error:recordedError}=await db.rpc('gmail_recorded_ids',{p_workspace:workspace,p_lease:lease,p_ids:page.messages.map(m=>m.id)});check(recordedError);
    const done=new Set((recorded ?? []).map((m:{provider_message_id:string})=>m.provider_message_id));
    for (const item of page.messages) {
      if(done.has(item.id))continue;
      if (Date.now()-started>40000) throw new GmailReadError('temporary');
      const message = await reader.message(item.id); const result = parseBarkMessage(message,connection.activated_at);
      const received = new Date(Number(message.internalDate));
      if (!Number.isFinite(received.getTime())) throw new GmailReadError('invalid_response');
      const { error: persistError } = await db.rpc('gmail_record_message',{p_workspace:workspace,p_lease:lease,p_message_id:item.id,p_thread_id:message.threadId ?? null,p_received_at:received.toISOString(),p_outcome:result.state,p_payload:result.state==='parsed'?result.lead:{},p_failure:result.state==='parsed'?null:result.code}); check(persistError); processed++;
    }
    const { error: finishError } = await db.from('gmail_connections').update({ page_token:page.nextPageToken ?? null, ...(page.nextPageToken?{}:{scan_after:new Date(Math.max(Date.parse(connection.activated_at),started-86400000)).toISOString()}),lease_id:null,lease_until:null,last_sync_at:new Date().toISOString(),last_error:null }).eq('workspace_id',workspace).eq('lease_id',lease).eq('enabled',true); check(finishError);
    return { state:'synced', processed };
  } catch (error) {
    const code = error instanceof GmailReadError ? error.code : 'sync_failed';
    await db.from('gmail_connections').update({last_error:code,lease_id:null,lease_until:null,...(code==='authorization'?{enabled:false}:{})}).eq('workspace_id',workspace).eq('lease_id',lease);
    return { state:'retry_required', processed, code };
  }
}
