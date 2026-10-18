import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createGmailReader, GmailReadError, header, messageText } from './gmailIntake.js';
import { digest, seal, unseal } from './gmailConnector.js';

const scope = 'https://www.googleapis.com/auth/gmail.readonly';
const sendScope = 'https://www.googleapis.com/auth/gmail.send';
const callbackPath = '/api/v1/inbound/agent-gmail/callback';

function config(env = process.env) {
  const names = ['GOOGLE_GMAIL_CLIENT_ID','GOOGLE_GMAIL_CLIENT_SECRET','AGENT_GMAIL_REDIRECT_URI','GMAIL_TOKEN_KEY'] as const;
  if (names.some((name) => !env[name])) throw new Error('Agent Gmail connection configuration is incomplete.');
  const redirect = new URL(env.AGENT_GMAIL_REDIRECT_URI!);
  if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.search || redirect.hash || redirect.pathname !== callbackPath) throw new Error('Invalid Agent Gmail callback configuration.');
  const key = Buffer.from(env.GMAIL_TOKEN_KEY!, 'base64');
  if (key.length !== 32) throw new Error('Invalid Gmail encryption configuration.');
  return { clientId: env.GOOGLE_GMAIL_CLIENT_ID!, clientSecret: env.GOOGLE_GMAIL_CLIENT_SECRET!, redirect: redirect.href, key, sendEnabled: env.AGENT_GMAIL_SEND_ENABLED === 'true' };
}

async function tokenRequest(fields: Record<string, string>) {
  const value = config();
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, ...fields }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new GmailReadError(response.status === 400 || response.status === 401 ? 'authorization' : 'temporary');
  const result = await response.json() as { access_token?: string; refresh_token?: string; scope?: string };
  if (typeof result.access_token !== 'string') throw new GmailReadError('invalid_response');
  return result as { access_token: string; refresh_token?: string; scope?: string };
}

function check(error: unknown) { if (error) throw new Error('Agent Gmail database operation failed.'); }

export async function agentGmailHealth(db: SupabaseClient, workspace: string, profile: string) {
  const { data, error } = await db.from('agent_gmail_connections').select('mailbox,status,enabled,connected_at,last_sync_at,last_error,granted_scopes').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(error);
  let setupReady = false; try { config(); setupReady = true; } catch { /* setup is reported to the UI */ }
  return { mailbox: data?.mailbox ?? '', status: data?.status ?? 'not_connected', enabled: data?.enabled ?? false, connectedAt: data?.connected_at, lastSyncAt: data?.last_sync_at, lastError: data?.last_error, grantedScopes: data?.granted_scopes ?? [], setupReady };
}

export async function saveAgentGmailMailbox(db: SupabaseClient, workspace: string, profile: string, mailbox: string) {
  const normalized = mailbox.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error('Enter a valid Gmail address.');
  const { data: current, error: currentError } = await db.from('agent_gmail_connections').select('status').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(currentError);
  if (current?.status === 'connected' || current?.status === 'pending_consent') throw new Error('Disconnect the current Gmail connection before changing its address.');
  const { error } = await db.from('agent_gmail_connections').upsert({ workspace_id: workspace, profile_id: profile, mailbox: normalized, status: 'not_connected', enabled: false, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,profile_id', ignoreDuplicates: false });
  check(error);
}

export async function startAgentGmailConnection(db: SupabaseClient, workspace: string, profile: string) {
  const { data: connection, error } = await db.from('agent_gmail_connections').select('mailbox').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(error);
  if (!connection?.mailbox) throw new Error('Save your Gmail address before connecting.');
  const value = config(); const state = randomBytes(32).toString('base64url'); const verifier = randomBytes(48).toString('base64url');
  const { error: stateError } = await db.from('agent_gmail_oauth_states').insert({ state_hash: digest(state), workspace_id: workspace, profile_id: profile, mailbox: connection.mailbox, verifier_cipher: seal(verifier, value.key, workspace), expires_at: new Date(Date.now() + 600000).toISOString() }); check(stateError);
  await db.from('agent_gmail_connections').update({ status: 'pending_consent', updated_at: new Date().toISOString() }).eq('workspace_id', workspace).eq('profile_id', profile);
  const query = new URLSearchParams({ client_id: value.clientId, redirect_uri: value.redirect, response_type: 'code', scope: value.sendEnabled ? `${scope} ${sendScope}` : scope, access_type: 'offline', prompt: 'consent', login_hint: connection.mailbox, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${query}`, state };
}

export async function finishAgentGmailConnection(db: SupabaseClient, state: string, cookie: string, code: string) {
  if (!state || state.length > 128 || !cookie || digest(state) !== digest(cookie) || !code || code.length > 4096) throw new Error('Gmail authorization expired. Start again.');
  const { data, error } = await db.from('agent_gmail_oauth_states').delete().eq('state_hash', digest(state)).gt('expires_at', new Date().toISOString()).select('*').maybeSingle(); check(error);
  if (!data) throw new Error('Gmail authorization expired. Start again.');
  const value = config();
  const verifier = unseal(data.verifier_cipher, value.key, data.workspace_id);
  const tokens = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: value.redirect, code_verifier: verifier });
  if (!tokens.refresh_token || !tokens.scope?.split(' ').includes(scope) || (value.sendEnabled && !tokens.scope.split(' ').includes(sendScope))) throw new Error(value.sendEnabled ? 'Gmail send consent was not completed.' : 'Read-only Gmail consent was not completed.');
  await createGmailReader(tokens.access_token).verifyMailbox(data.mailbox);
  const { error: saveError } = await db.from('agent_gmail_connections').update({ encrypted_refresh_token: seal(tokens.refresh_token, value.key, data.workspace_id), granted_scopes: tokens.scope.split(' '), status: 'connected', enabled: true, scan_after: new Date().toISOString(), connected_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('workspace_id', data.workspace_id).eq('profile_id', data.profile_id).eq('mailbox', data.mailbox);
  check(saveError);
}

function addresses(value: string) { return [...value.matchAll(/<([^<>@\s]+@[^<>@\s]+)>|\b([^<>@\s]+@[^<>@\s]+)\b/g)].map((match) => (match[1] ?? match[2]).toLowerCase()); }

export async function syncAgentGmail(db: SupabaseClient, workspace: string, profile: string) {
  const { data: connection, error } = await db.from('agent_gmail_connections').select('*').eq('workspace_id', workspace).eq('profile_id', profile).eq('enabled', true).maybeSingle(); check(error);
  if (!connection?.encrypted_refresh_token) return { state: 'not_connected', processed: 0, linked: 0 };
  const lease = randomUUID();
  const { data: claimed, error: claimError } = await db.from('agent_gmail_connections').update({ lease_id: lease, lease_until: new Date(Date.now() + 180000).toISOString() }).eq('id', connection.id).eq('enabled', true).is('lease_id', null).select('*').maybeSingle(); check(claimError);
  if (!claimed) return { state: 'busy', processed: 0, linked: 0 };
  const run = await db.from('agent_email_sync_runs').insert({ workspace_id: workspace, connection_id: connection.id }).select('id').single(); check(run.error);
  let processed = 0; let linked = 0; let reviewCount = 0;
  try {
    const value = config(); const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(connection.encrypted_refresh_token, value.key, workspace) });
    const reader = createGmailReader(tokens.access_token); await reader.verifyMailbox(connection.mailbox);
    const page = await reader.list(connection.scan_after ?? connection.connected_at ?? new Date().toISOString(), connection.page_token ?? undefined, '');
    const opportunities = await db.from('opportunities').select('id,contacts(email)').eq('workspace_id', workspace); check(opportunities.error);
    const byEmail = new Map<string, string[]>();
    for (const row of opportunities.data ?? []) for (const contact of (Array.isArray(row.contacts) ? row.contacts : row.contacts ? [row.contacts] : [])) if (contact.email) byEmail.set(String(contact.email).toLowerCase(), [...(byEmail.get(String(contact.email).toLowerCase()) ?? []), String(row.id)]);
    for (const item of page.messages) {
      const message = await reader.message(item.id); const occurredAt = new Date(Number(message.internalDate)); if (!Number.isFinite(occurredAt.getTime())) continue;
      const thread = await db.from('agent_email_threads').upsert({ workspace_id: workspace, connection_id: connection.id, provider_thread_id: message.threadId ?? message.id, subject: header(message, 'subject') || null, participants: [...new Set([...addresses(header(message, 'from')), ...addresses(header(message, 'to')), ...addresses(header(message, 'cc'))])], first_message_at: occurredAt.toISOString(), last_message_at: occurredAt.toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'connection_id,provider_thread_id' }).select('id').single(); check(thread.error); if (!thread.data?.id) throw new Error('Email thread was not saved.');
      const messageRow = await db.from('agent_email_messages').upsert({ workspace_id: workspace, connection_id: connection.id, thread_id: thread.data.id, provider_message_id: message.id, direction: message.labelIds?.includes('SENT') ? 'outbound' : 'inbound', sender: header(message, 'from') || null, recipients: addresses(`${header(message, 'to')},${header(message, 'cc')}`), subject: header(message, 'subject') || null, occurred_at: occurredAt.toISOString(), encrypted_body: seal(messageText(message).slice(0, 50000), value.key, workspace), headers: { messageId: header(message, 'message-id'), inReplyTo: header(message, 'in-reply-to') } }, { onConflict: 'connection_id,provider_message_id' }).select('id').maybeSingle(); check(messageRow.error);
      if (!messageRow.data) continue;
      processed++;
      const messageAddresses = [...new Set([...addresses(header(message, 'from')), ...addresses(header(message, 'to'))])];
      const candidates = new Set<string>(); for (const address of messageAddresses) for (const opportunityId of byEmail.get(address) ?? []) candidates.add(opportunityId);
      for (const opportunityId of candidates) { const result = await db.from('agent_email_message_links').upsert({ workspace_id: workspace, message_id: messageRow.data.id, opportunity_id: opportunityId, confidence: 100, match_reason: 'exact_contact_email', linked_by: profile }, { onConflict: 'message_id,opportunity_id', ignoreDuplicates: true }); check(result.error); linked++; }
      if (!candidates.size) { const review = await db.from('agent_email_match_reviews').upsert({ workspace_id: workspace, message_id: messageRow.data.id, reason: 'no_exact_contact_match', candidate_emails: messageAddresses, status: 'pending' }, { onConflict: 'message_id', ignoreDuplicates: true }); check(review.error); reviewCount++; }
    }
    const now = new Date().toISOString(); const update = await db.from('agent_gmail_connections').update({ page_token: page.nextPageToken ?? null, scan_after: page.nextPageToken ? connection.scan_after : now, last_sync_at: now, last_error: null, lease_id: null, lease_until: null, status: 'connected', updated_at: now }).eq('id', connection.id).eq('lease_id', lease); check(update.error);
    if (!run.data?.id) throw new Error('Email sync run was not saved.');
    check((await db.from('agent_email_sync_runs').update({ finished_at: now, imported_count: processed, review_count: reviewCount }).eq('id', run.data.id)).error);
    return { state: 'synced', processed, linked };
  } catch (reason) {
    const code = reason instanceof GmailReadError ? reason.code : 'sync_failed'; const now = new Date().toISOString(); await db.from('agent_gmail_connections').update({ status: code === 'authorization' ? 'revoked' : 'error', last_error: code, lease_id: null, lease_until: null, updated_at: now }).eq('id', connection.id).eq('lease_id', lease); if (run.data?.id) await db.from('agent_email_sync_runs').update({ finished_at: now, imported_count: processed, failure_code: code }).eq('id', run.data.id); return { state: 'retry_required', processed, linked, code };
  }
}

export async function disconnectAgentGmail(db: SupabaseClient, workspace: string, profile: string) {
  const { error } = await db.from('agent_gmail_connections').update({ encrypted_refresh_token: null, granted_scopes: [], enabled: false, status: 'revoked', last_error: null, updated_at: new Date().toISOString() }).eq('workspace_id', workspace).eq('profile_id', profile); check(error);
}

export async function agentGmailMatchReviews(db: SupabaseClient, workspace: string, profile: string) {
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(connectionError);
  if (!connection?.id) return [];
  const { data: messages, error: messageError } = await db.from('agent_email_messages').select('id,subject,sender,occurred_at').eq('workspace_id', workspace).eq('connection_id', connection.id).order('occurred_at', { ascending: false }).limit(200); check(messageError);
  const messageIds = (messages ?? []).map((message) => message.id);
  if (!messageIds.length) return [];
  const { data: reviews, error: reviewError } = await db.from('agent_email_match_reviews').select('id,message_id,reason,candidate_emails,status,created_at').eq('workspace_id', workspace).eq('status', 'pending').in('message_id', messageIds).order('created_at', { ascending: false }).limit(100); check(reviewError);
  const byId = new Map((messages ?? []).map((message) => [message.id, message]));
  return (reviews ?? []).map((review) => ({ ...review, message: byId.get(review.message_id) ?? null }));
}

export async function resolveAgentGmailMatchReview(db: SupabaseClient, workspace: string, profile: string, reviewId: string, decision: 'linked' | 'ignored', opportunityId?: string) {
  const { data: review, error: reviewError } = await db.from('agent_email_match_reviews').select('id,message_id,status').eq('id', reviewId).eq('workspace_id', workspace).maybeSingle(); check(reviewError);
  if (!review || review.status !== 'pending') throw new Error('This email review is no longer pending.');
  const { data: message, error: messageError } = await db.from('agent_email_messages').select('id,connection_id').eq('id', review.message_id).eq('workspace_id', workspace).maybeSingle(); check(messageError);
  if (!message) throw new Error('The email message was not found.');
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('id', message.connection_id).eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(connectionError);
  if (!connection) throw new Error('You cannot review this mailbox message.');
  if (decision === 'linked') {
    if (!opportunityId) throw new Error('Choose a CRM lead before linking this message.');
    const { data: opportunity, error: opportunityError } = await db.from('opportunities').select('id').eq('id', opportunityId).eq('workspace_id', workspace).maybeSingle(); check(opportunityError);
    if (!opportunity) throw new Error('The selected CRM lead was not found.');
    const link = await db.from('agent_email_message_links').upsert({ workspace_id: workspace, message_id: message.id, opportunity_id: opportunity.id, confidence: 80, match_reason: 'manual_review', linked_by: profile }, { onConflict: 'message_id,opportunity_id', ignoreDuplicates: true }); check(link.error);
  }
  const { error } = await db.from('agent_email_match_reviews').update({ status: decision, opportunity_id: decision === 'linked' ? opportunityId : null, reviewed_by: profile, reviewed_at: new Date().toISOString() }).eq('id', review.id).eq('status', 'pending'); check(error);
}

export async function agentGmailContext(db: SupabaseClient, workspace: string, profile: string) {
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(connectionError);
  if (!connection?.id) return [];
  const { data: messages, error: messageError } = await db.from('agent_email_messages').select('id,subject,sender,recipients,direction,occurred_at,encrypted_body').eq('workspace_id', workspace).eq('connection_id', connection.id).order('occurred_at', { ascending: false }).limit(100); check(messageError);
  const ids = (messages ?? []).map((item) => item.id); if (!ids.length) return [];
  const { data: links, error: linkError } = await db.from('agent_email_message_links').select('message_id,opportunity_id,confidence,match_reason').eq('workspace_id', workspace).in('message_id', ids).is('unlinked_at', null); check(linkError);
  const linkByMessage = new Map<string, typeof links>(); for (const link of links ?? []) linkByMessage.set(link.message_id, [...(linkByMessage.get(link.message_id) ?? []), link]);
  const value = config(); const visible = (messages ?? []).filter((item) => linkByMessage.has(item.id)); const { data: suggestions, error: suggestionError } = await db.from('agent_email_context_suggestions').select('id,message_id,generator,model_version,summary,intent,objections,suggested_next_action,suggested_status,suggested_qualification,suggested_follow_up_at,state,created_at').eq('workspace_id', workspace).in('message_id', visible.map((item) => item.id)); check(suggestionError); const suggestionByMessage = new Map((suggestions ?? []).map((item) => [item.message_id, item]));
  return visible.map((item) => ({ id: item.id, subject: item.subject, sender: item.sender, recipients: item.recipients, direction: item.direction, occurred_at: item.occurred_at, body: item.encrypted_body ? unseal(item.encrypted_body, value.key, workspace).slice(0, 12000) : '', links: linkByMessage.get(item.id) ?? [], suggestion: suggestionByMessage.get(item.id) ?? null }));
}

function contextSuggestion(body: string, subject: string | null) {
  const text = `${subject ?? ''} ${body}`.toLowerCase();
  const objections = ['price', 'budget', 'expensive', 'timeline', 'competitor', 'not interested', 'later'].filter((word) => text.includes(word));
  const intent = text.includes('meeting') || text.includes('schedule') ? 'meeting_interest' : text.includes('quote') || text.includes('proposal') || text.includes('pricing') ? 'pricing_request' : text.includes('unsubscribe') || text.includes('stop') ? 'do_not_contact_signal' : text.includes('question') || text.includes('?') ? 'information_request' : 'general_inquiry';
  const suggestedNextAction = intent === 'meeting_interest' ? 'Confirm the meeting time and record the agreed next step.' : intent === 'pricing_request' ? 'Review the request and send or discuss pricing after agent approval.' : intent === 'do_not_contact_signal' ? 'Check suppression rules before any further outreach.' : 'Review the message and choose the next follow-up manually.';
  const summary = `${subject ? `${subject}: ` : ''}${body.replace(/\s+/g, ' ').trim().slice(0, 360) || 'No readable message text.'}`;
  const suggestedStatus = intent === 'do_not_contact_signal' ? 'do_not_contact' : intent === 'meeting_interest' ? 'connected' : intent === 'pricing_request' || intent === 'information_request' ? 'follow_up_required' : null;
  const suggestedFollowUpAt = suggestedStatus && suggestedStatus !== 'do_not_contact' ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
  return { generator: 'rules_v1', model_version: 'email-context-rules-1.0.0', summary, intent, objections, suggested_next_action: suggestedNextAction, suggested_status: suggestedStatus, suggested_qualification: null, suggested_follow_up_at: suggestedFollowUpAt };
}

export async function generateAgentGmailContextSuggestion(db: SupabaseClient, workspace: string, profile: string, messageId: string) {
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(connectionError); if (!connection?.id) throw new Error('Mailbox connection not found.');
  const { data: message, error: messageError } = await db.from('agent_email_messages').select('id,subject,encrypted_body').eq('workspace_id', workspace).eq('connection_id', connection.id).eq('id', messageId).maybeSingle(); check(messageError); if (!message) throw new Error('Email message not found.');
  const { data: link, error: linkError } = await db.from('agent_email_message_links').select('opportunity_id').eq('workspace_id', workspace).eq('message_id', messageId).is('unlinked_at', null).limit(1).maybeSingle(); check(linkError); if (!link) throw new Error('Only linked email messages can receive suggestions.');
  const value = config(); const suggestion = contextSuggestion(message.encrypted_body ? unseal(message.encrypted_body, value.key, workspace) : '', message.subject);
  const { data, error } = await db.from('agent_email_context_suggestions').upsert({ workspace_id: workspace, message_id: message.id, opportunity_id: link.opportunity_id, ...suggestion, state: 'pending', updated_at: new Date().toISOString() }, { onConflict: 'message_id' }).select('id,message_id,generator,model_version,summary,intent,objections,suggested_next_action,suggested_status,suggested_qualification,suggested_follow_up_at,state,created_at').single(); check(error); return data;
}

export async function resolveAgentGmailContextSuggestion(db: SupabaseClient, workspace: string, profile: string, suggestionId: string, state: 'accepted' | 'dismissed') {
  const { data: suggestion, error: suggestionError } = await db.from('agent_email_context_suggestions').select('id,message_id').eq('id', suggestionId).eq('workspace_id', workspace).maybeSingle(); check(suggestionError); if (!suggestion) throw new Error('Context suggestion not found.');
  const { data: message, error: messageError } = await db.from('agent_email_messages').select('connection_id').eq('id', suggestion.message_id).eq('workspace_id', workspace).maybeSingle(); check(messageError); if (!message) throw new Error('Email message not found.');
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('id', message.connection_id).eq('workspace_id', workspace).eq('profile_id', profile).maybeSingle(); check(connectionError); if (!connection) throw new Error('You cannot review this mailbox suggestion.');
  const { error } = await db.from('agent_email_context_suggestions').update({ state, updated_at: new Date().toISOString() }).eq('id', suggestion.id); check(error);
}

export async function agentGmailSuggestionStats(db: SupabaseClient, workspace: string, profile: string) {
  const { data: connections, error: connectionError } = await db.from('agent_gmail_connections').select('id').eq('workspace_id', workspace).eq('profile_id', profile); check(connectionError);
  const ids = (connections ?? []).map((item) => item.id); if (!ids.length) return { generated: 0, pending: 0, accepted: 0, dismissed: 0 };
  const { data: messages, error: messageError } = await db.from('agent_email_messages').select('id').eq('workspace_id', workspace).in('connection_id', ids); check(messageError);
  const messageIds = (messages ?? []).map((item) => item.id); if (!messageIds.length) return { generated: 0, pending: 0, accepted: 0, dismissed: 0 };
  const { data: suggestions, error: suggestionError } = await db.from('agent_email_context_suggestions').select('state').eq('workspace_id', workspace).in('message_id', messageIds); check(suggestionError);
  return (suggestions ?? []).reduce((stats, item) => { stats.generated++; if (item.state === 'pending') stats.pending++; if (item.state === 'accepted') stats.accepted++; if (item.state === 'dismissed') stats.dismissed++; return stats; }, { generated: 0, pending: 0, accepted: 0, dismissed: 0 });
}

export async function agentGmailReviewOpportunities(db: SupabaseClient, workspace: string, search: string) {
  const term = search.trim(); if (term.length < 2) return [];
  const escaped = term.replace(/[%_]/g, '\\$&');
  const { data, error } = await db.from('opportunities').select('id,contacts(name,normalized_email,normalized_phone)').eq('workspace_id', workspace).or(`contacts.name.ilike.%${escaped}%,contacts.normalized_email.ilike.%${escaped}%,contacts.normalized_phone.ilike.%${escaped}%`).order('updated_at', { ascending: false }).limit(20); check(error);
  return (data ?? []).map((item) => { const row = item as { id: string; contacts?: { name?: string | null; normalized_email?: string | null; normalized_phone?: string | null } | Array<{ name?: string | null; normalized_email?: string | null; normalized_phone?: string | null }> | null }; const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts; return { id: row.id, name: contact?.name, email: contact?.normalized_email, phone: contact?.normalized_phone }; });
}

function encodeBase64Url(value: string) { return Buffer.from(value, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function headerSafe(value: string, label: string) { if (/[\r\n]/.test(value)) throw new Error(`${label} contains an invalid line break.`); return value; }

export async function sendAgentGmailEmail(db: SupabaseClient, workspace: string, profile: string, opportunityId: string, input: { toEmail: string; subject: string; body: string; replyToMessageId?: string }) {
  const value = config();
  if (!value.sendEnabled) throw new Error('Manual Gmail sending is not enabled in this environment.');
  const toEmail = input.toEmail.trim().toLowerCase(); const subject = input.subject.trim(); const body = input.body.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) throw new Error('Enter a valid recipient email address.');
  if (!subject || subject.length > 200) throw new Error('Subject is required and must be 200 characters or fewer.');
  if (!body || body.length > 10000) throw new Error('Email message is required and must be 10,000 characters or fewer.');
  const { data: connection, error: connectionError } = await db.from('agent_gmail_connections').select('*').eq('workspace_id', workspace).eq('profile_id', profile).eq('enabled', true).maybeSingle(); check(connectionError);
  if (!connection?.encrypted_refresh_token) throw new Error('Connect your Gmail account before sending.');
  if (!(connection.granted_scopes ?? []).includes(sendScope)) throw new Error('Reconnect Gmail and approve sending email from the CRM.');
  const { data: opportunity, error: opportunityError } = await db.from('opportunities').select('id,status,contacts(email),assignments(assigned_to,ended_at)').eq('workspace_id', workspace).eq('id', opportunityId).maybeSingle(); check(opportunityError);
  if (!opportunity) throw new Error('Lead not found.');
  if (['incorrect', 'duplicate', 'do_not_contact'].includes(opportunity.status)) throw new Error('This lead is not eligible for email outreach.');
  const row = opportunity as { id: string; status: string; contacts?: { email?: string | null } | Array<{ email?: string | null }> | null; assignments?: Array<{ assigned_to?: string | null; ended_at?: string | null }> };
  const contact = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts; const storedEmail = contact?.email?.trim().toLowerCase();
  if (!storedEmail || storedEmail !== toEmail) throw new Error('The recipient must match the lead email saved in the CRM.');
  if (!(row.assignments ?? []).some((assignment) => assignment.assigned_to === profile && !assignment.ended_at)) throw new Error('Only the current lead owner can send from this mailbox.');
  const audit = await db.from('agent_email_sends').insert({ workspace_id: workspace, connection_id: connection.id, opportunity_id: opportunityId, profile_id: profile, to_email: toEmail, subject, body_preview: body.slice(0, 500), status: 'pending' }).select('id').single(); check(audit.error);
  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: unseal(connection.encrypted_refresh_token, value.key, workspace) });
    const lines = [`To: ${headerSafe(toEmail, 'Recipient')}`, `Subject: ${headerSafe(subject, 'Subject')}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"'];
    let replyHeaders: Record<string, string> = {};
    if (input.replyToMessageId) {
      const { data: replyMessage, error: replyError } = await db.from('agent_email_messages').select('headers').eq('id', input.replyToMessageId).eq('workspace_id', workspace).maybeSingle(); check(replyError);
      const headers = (replyMessage?.headers ?? {}) as { messageId?: string; inReplyTo?: string };
      if (headers.messageId) { replyHeaders = { 'In-Reply-To': headerSafe(headers.messageId, 'Reply header'), References: headerSafe(headers.messageId, 'Reply header') }; lines.push(`In-Reply-To: ${replyHeaders['In-Reply-To']}`, `References: ${replyHeaders.References}`); }
    }
    lines.push('', body);
    const raw = encodeBase64Url(lines.join('\r\n'));
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) { const code = response.status === 401 || response.status === 403 ? 'authorization' : response.status >= 500 ? 'temporary' : 'send_failed'; await db.from('agent_email_sends').update({ status: 'failed', failure_code: code }).eq('id', audit.data.id); throw new GmailReadError(code); }
    const sent = await response.json() as { id?: string; threadId?: string };
    if (!sent.id) throw new GmailReadError('invalid_response');
    const thread = await db.from('agent_email_threads').upsert({ workspace_id: workspace, connection_id: connection.id, provider_thread_id: sent.threadId ?? sent.id, subject, participants: [toEmail, connection.mailbox], first_message_at: new Date().toISOString(), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'connection_id,provider_thread_id' }).select('id').single(); check(thread.error);
    const message = await db.from('agent_email_messages').upsert({ workspace_id: workspace, connection_id: connection.id, thread_id: thread.data.id, provider_message_id: sent.id, direction: 'outbound', sender: connection.mailbox, recipients: [toEmail], subject, occurred_at: new Date().toISOString(), encrypted_body: seal(body, value.key, workspace), headers: replyHeaders }, { onConflict: 'connection_id,provider_message_id' }).select('id').single(); check(message.error);
    check((await db.from('agent_email_message_links').upsert({ workspace_id: workspace, message_id: message.data.id, opportunity_id: opportunityId, confidence: 100, match_reason: 'manual_send', linked_by: profile }, { onConflict: 'message_id,opportunity_id', ignoreDuplicates: true })).error);
    check((await db.from('activities').insert({ opportunity_id: opportunityId, actor_id: profile, type: 'email', outcome: 'email_sent', body: `Email sent from ${connection.mailbox}: ${subject}`, occurred_at: new Date().toISOString(), metadata: { source: 'agent_gmail_manual_send', provider_message_id: sent.id } })).error);
    check((await db.from('agent_email_sends').update({ status: 'sent', message_id: message.data.id, provider_message_id: sent.id, sent_at: new Date().toISOString() }).eq('id', audit.data.id)).error);
    return { status: 'sent' as const, messageId: message.data.id };
  } catch (error) {
    if (!(error instanceof GmailReadError)) await db.from('agent_email_sends').update({ status: 'failed', failure_code: 'send_failed' }).eq('id', audit.data.id);
    throw error;
  }
}
