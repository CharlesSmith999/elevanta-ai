import type { Session } from '@supabase/supabase-js';
import { mapOpportunity, mapResearchLead, request, type OpportunityRecord, type RemoteResearchLead } from './api';
import type { WorkspaceSummary } from './workspaceSummary';

export function workspaceParams(filters: Record<string, unknown>) {
  return new URLSearchParams(Object.entries(filters).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== '').map(([key, value]) => [key, String(value)]));
}
export const workspaceKey = (session: Session, kind: string, filters: Record<string, unknown> = {}) => JSON.stringify([session.user.id, kind, filters]);
export type LeadPage = { opportunities: OpportunityRecord[]; total: number; offset: number; limit: number; hasMore: boolean; queues: Record<string, number>; sources: string[]; owners: string[] };
export async function loadLeadPage(session: Session, filters: Record<string, unknown>, signal?: AbortSignal) {
  const result = await request<LeadPage>(session, `/v1/workspace/leads?${workspaceParams(filters)}`, {signal});
  return {...result, leads: result.opportunities.map(mapOpportunity)};
}
export async function loadLeadDetail(session: Session, id: string, viewerId: string, signal?: AbortSignal) {
  const result = await request<{opportunity: OpportunityRecord}>(session, `/v1/workspace/leads/${id}?${workspaceParams({viewerId})}`, {signal});
  return mapOpportunity(result.opportunity);
}
export async function loadResearchPage(session: Session, filters: Record<string, unknown>, signal?: AbortSignal) {
  const result = await request<{researchLeads: RemoteResearchLead[]; total: number; offset: number; limit: number; hasMore: boolean; counts: Record<string, number>; recentCount: number}>(session, `/v1/workspace/research?${workspaceParams(filters)}`, {signal});
  return {...result, items: result.researchLeads.map(mapResearchLead)};
}
export async function loadResearchDetail(session: Session, id: string, viewerId: string, signal?: AbortSignal) {
  const result = await request<{researchLead: RemoteResearchLead}>(session, `/v1/workspace/research/${id}?${workspaceParams({viewerId})}`, {signal});
  return mapResearchLead(result.researchLead);
}
export const loadWorkspaceSummary = (session: Session, filters: Record<string, unknown>, signal?: AbortSignal) => request<WorkspaceSummary>(session, `/v1/workspace/summary?${workspaceParams(filters)}`, {signal});
