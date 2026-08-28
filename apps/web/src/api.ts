import type { Session } from '@supabase/supabase-js';
import type { Activity, Assignment, FollowUp, IncorrectReport, Lead, LeadCategory, OpportunityStatus, Qualification, Role, StageHistory } from './domain';
import type { ContactFocus, ContactHealth, ContactMethodType } from './leadWorkflow';
import { supabase } from './auth';

/**
 * Production is a single Vercel deployment, so API calls must stay on the
 * current origin. This also prevents an old VITE_API_URL value baked into a
 * cached bundle from sending signed-in requests to a retired API host.
 * Local development may still opt into an explicit API URL.
 */
const configuredApiBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const apiBase = import.meta.env.DEV && configuredApiBase ? configuredApiBase.replace(/\/+$/, '') : '/api';

type OpportunityRecord = {
  id: string;
  status: OpportunityStatus;
  qualification: Qualification;
  source?: string;
  lead_category?: LeadCategory | null;
  marketing_owner_id?: string | null;
  description?: string;
  created_at: string;
  updated_at: string;
  contacts?: { name: string; normalized_phone?: string | null; normalized_email?: string | null } | null;
  assignments?: Array<{ id: string; assigned_to: string; assigned_by: string; visibility_mode: 'full_context' | 'fresh_start'; reason?: string | null; started_at: string; ended_at?: string | null }>;
  activities?: Array<{ id: string; actor_id?: string | null; type: string; body?: string | null; from_status?: OpportunityStatus | null; to_status?: OpportunityStatus | null; created_at: string }>;
  follow_ups?: Array<{ id: string; owner_id: string; due_at: string; action_type: FollowUp['action']; status: FollowUp['status']; completed_at?: string | null }>;
  incorrect_reports?: Array<{ id: string; reporter_id: string; reporter_role?: Role | null; reason_code: string; evidence?: string | null; created_at: string }>;
  incorrect_reviews?: Array<{ id: string; decision?: 'confirmed_incorrect' | 'rejected' | 'merge_duplicate' | null; reviewer_id?: string | null; decision_reason?: string | null; decided_at?: string | null }>;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export type ManagedUser = {
  id: string;
  workspace_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'sales_agent' | 'marketer';
  department: 'marketing' | 'sales' | null;
  manager_id: string | null;
  active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
};

export type WorkspaceMember = {
  id: string;
  full_name: string;
  role: 'admin' | 'manager' | 'sales_agent' | 'marketer';
  department: 'marketing' | 'sales' | null;
  manager_id: string | null;
  active: boolean;
};

export type RemoteContactMethod = {
  id: string;
  health: ContactHealth;
  focus: ContactFocus;
  assessment_reason?: string | null;
  last_assessed_at?: string | null;
  contact_methods?: {
    id: string;
    method_type: ContactMethodType;
    value: string;
    label?: string | null;
    globally_restricted?: boolean;
  } | null;
};

export type RemoteActivity = {
  id: string;
  type: string;
  outcome?: string | null;
  body?: string | null;
  occurred_at?: string | null;
  created_at: string;
  contact_methods?: { value: string; method_type: ContactMethodType } | null;
};

async function send(session: Session, path: string, init?: RequestInit) {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers ?? {}) },
  });
}

async function request<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  let response = await send(session, path, init);
  if (response.status === 401 && supabase) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) response = await send(data.session, path, init);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new ApiError(response.status, body.message ?? `CRM request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function mapOpportunity(record: OpportunityRecord): Lead {
  const assignments: Assignment[] = (record.assignments ?? []).map((item) => ({ id: item.id, ownerId: item.assigned_to, assignedBy: item.assigned_by, at: item.started_at, endedAt: item.ended_at ?? undefined, visibility: item.visibility_mode, reason: item.reason ?? 'CRM assignment' }));
  const activities: Activity[] = (record.activities ?? []).map((item) => ({ id: item.id, actorId: item.actor_id ?? 'system', at: item.created_at, kind: item.type === 'note' ? 'note' : item.type === 'assignment' ? 'assignment' : item.type === 'follow_up' ? 'follow_up' : item.type === 'incorrect_report' ? 'incorrect_report' : item.type === 'status_change' ? 'status' : 'system', body: item.body ?? 'CRM activity' }));
  const followUps: FollowUp[] = (record.follow_ups ?? []).map((item) => ({ id: item.id, ownerId: item.owner_id, dueAt: item.due_at, action: item.action_type, status: item.status }));
  const incorrectReports: IncorrectReport[] = (record.incorrect_reports ?? []).map((item) => ({ reporterId: item.reporter_id, reporterRole: item.reporter_role ?? undefined, reason: item.reason_code, evidence: item.evidence ?? undefined, at: item.created_at }));
  const review = record.incorrect_reviews?.[0];
  const stageHistory: StageHistory[] = (record.activities ?? []).filter((item) => item.type === 'status_change' && item.to_status).map((item) => ({ id: item.id, fromStatus: item.from_status ?? undefined, toStatus: item.to_status!, enteredAt: item.created_at, actorId: item.actor_id ?? undefined, reason: item.body ?? 'Status updated' }));
  const currentOwner = assignments.find((item) => !item.endedAt)?.ownerId;
  return {
    id: record.id,
    name: record.contacts?.name ?? 'Unnamed contact',
    phone: record.contacts?.normalized_phone ?? undefined,
    email: record.contacts?.normalized_email ?? undefined,
    source: record.source ?? 'Other',
    category: record.lead_category ?? 'not_available',
    description: record.description ?? undefined,
    marketingOwnerId: record.marketing_owner_id ?? 'shariq',
    sourceDate: record.created_at,
    status: record.status,
    qualification: record.qualification,
    priority: 0,
    assignments,
    stageHistory,
    activities,
    followUps,
    incorrectReports,
    incorrectReview: review?.decision ? { state: review.decision, reviewerId: review.reviewer_id ?? undefined, reason: review.decision_reason ?? undefined, decidedAt: review.decided_at ?? undefined } : incorrectReports.length >= 3 ? { state: 'pending' } : undefined,
    routingPaused: !review?.decision && incorrectReports.length >= 3,
    lostReason: undefined,
    duplicateOf: undefined,
    ...(currentOwner ? {} : {}),
  };
}

export async function loadRemoteLeads(session: Session): Promise<Lead[]> {
  const result = await request<{ opportunities: OpportunityRecord[] }>(session, '/v1/opportunities');
  return result.opportunities.map(mapOpportunity);
}

export async function loadWorkspaceMembers(session: Session): Promise<WorkspaceMember[]> {
  const result = await request<{ users: WorkspaceMember[] }>(session, '/v1/workspace-members');
  return result.users;
}

export const createRemoteLead = (session: Session, body: unknown) => request<{ opportunityId: string }>(session, '/v1/opportunities', { method: 'POST', body: JSON.stringify(body) });
export const updateRemoteLeadDetails = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/details`, { method: 'PATCH', body: JSON.stringify(body) });
export const updateRemoteStatus = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/status`, { method: 'POST', body: JSON.stringify(body) });
export const addRemoteNote = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/notes`, { method: 'POST', body: JSON.stringify(body) });
export const addRemoteFollowUp = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/follow-ups`, { method: 'POST', body: JSON.stringify(body) });
export const completeRemoteFollowUp = (session: Session, id: string) => request<void>(session, `/v1/follow-ups/${id}/complete`, { method: 'POST' });
export const reassignRemoteLead = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/assignments`, { method: 'POST', body: JSON.stringify(body) });
export const reportRemoteIncorrect = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/incorrect-reports`, { method: 'POST', body: JSON.stringify(body) });
export const decideRemoteReview = (session: Session, id: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/incorrect-review`, { method: 'POST', body: JSON.stringify(body) });
export const loadAdminUsers = (session: Session) => request<{ users: ManagedUser[] }>(session, '/v1/admin/users');
export const createAdminUser = (session: Session, body: unknown) => request<{ user: ManagedUser }>(session, '/v1/admin/users', { method: 'POST', body: JSON.stringify(body) });
export const updateAdminUser = (session: Session, id: string, body: unknown) => request<{ user: ManagedUser }>(session, `/v1/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const loadRemoteContactMethods = (session: Session, id: string) => request<{ contactMethods: RemoteContactMethod[] }>(session, `/v1/opportunities/${id}/contact-methods`);
export const loadRemoteActivityHistory = (session: Session, id: string) => request<{ activities: RemoteActivity[] }>(session, `/v1/opportunities/${id}/activity-history`);
export const addRemoteContactMethod = (session: Session, id: string, body: unknown) => request<{ contactMethodId: string }>(session, `/v1/opportunities/${id}/contact-methods`, { method: 'POST', body: JSON.stringify(body) });
export const assessRemoteContactMethod = (session: Session, id: string, contactMethodId: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/contact-methods/${contactMethodId}`, { method: 'PATCH', body: JSON.stringify(body) });
export const restoreRemoteContactMethod = (session: Session, id: string, contactMethodId: string, body: unknown) => request<void>(session, `/v1/opportunities/${id}/contact-methods/${contactMethodId}/restore`, { method: 'POST', body: JSON.stringify(body) });
export const logRemoteSalesActivity = (session: Session, id: string, body: unknown) => request<{ activityId: string }>(session, `/v1/opportunities/${id}/activities`, { method: 'POST', body: JSON.stringify(body) });
