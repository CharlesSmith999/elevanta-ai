export type XaviarProfile = { id: string; workspace_id: string; role: 'admin' | 'manager' | 'sales_agent' | 'marketer'; manager_id: string | null; department?: 'marketing' | 'sales' | null };
export type XaviarOpportunity = {
  id: string; status: string; qualification?: string | null; source?: string | null; marketing_owner_id?: string | null;
  created_at: string; updated_at?: string; won_at?: string | null; lost_reason?: string | null;
  assignments?: Array<{ assigned_to: string; started_at: string; ended_at?: string | null }>;
  follow_ups?: Array<{ id: string; owner_id: string; due_at: string; status: string }>;
  activities?: Array<{ id: string; type: string; actor_id?: string | null; created_at: string; from_status?: string | null; to_status?: string | null }>;
};

export const XAVIAR_MODEL_VERSION = 'xaviar-rules-1.0.0';
export const XAVIAR_MIN_PREDICTION_SAMPLE = 20;
const terminal = new Set(['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact']);

export function canRequestXaviar(viewer: XaviarProfile, subject: XaviarProfile): boolean {
  if (viewer.workspace_id !== subject.workspace_id) return false;
  if (viewer.role === 'admin') return true;
  if (viewer.id === subject.id) return true;
  return viewer.role === 'manager' && subject.manager_id === viewer.id;
}

export function opportunityBelongsToSubject(opportunity: XaviarOpportunity, subject: XaviarProfile, managedIds: string[] = []): boolean {
  if (subject.role === 'admin') return true;
  if (subject.role === 'marketer') return opportunity.marketing_owner_id === subject.id;
  const activeOwner = opportunity.assignments?.find((item) => !item.ended_at)?.assigned_to;
  if (subject.role === 'sales_agent') return activeOwner === subject.id;
  return Boolean(activeOwner && managedIds.includes(activeOwner));
}

const evidence = (opportunity: XaviarOpportunity, label: string) => ({ id: `opportunity:${opportunity.id}`, kind: 'opportunity', label, opportunityId: opportunity.id, occurredAt: opportunity.updated_at ?? opportunity.created_at });
const expiry = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

export function buildApiXaviarReport(subject: XaviarProfile, opportunities: XaviarOpportunity[], now = new Date()) {
  const usable = opportunities.filter((item) => item.status !== 'duplicate' && item.status !== 'incorrect');
  const overdue = usable.filter((item) => item.follow_ups?.some((followUp) => followUp.status === 'open' && new Date(followUp.due_at) < now));
  const noNextAction = usable.filter((item) => !terminal.has(item.status) && !item.follow_ups?.some((followUp) => followUp.status === 'open'));
  const connected = usable.filter((item) => item.status === 'connected' || item.activities?.some((activity) => activity.to_status === 'connected')).length;
  const qualified = usable.filter((item) => item.qualification === 'mql' || item.qualification === 'sql').length;
  const won = usable.filter((item) => item.status === 'won').length;
  const recommendations = [];
  if (overdue.length) recommendations.push({ id: 'follow-up-overdue', capability: 'recommend', title: 'Recover overdue follow-ups', reason: `${overdue.length} visible opportunities have overdue work.`, action: 'Complete or reschedule every overdue follow-up.', priority: 'high', confidence: 'high', expiresAt: expiry(now, 1), evidence: overdue.slice(0, 5).map((item) => evidence(item, 'Overdue follow-up recorded')), state: 'new' });
  if (noNextAction.length) recommendations.push({ id: 'missing-next-action', capability: 'recommend', title: 'Give active opportunities a next action', reason: `${noNextAction.length} active opportunities have no open follow-up.`, action: 'Add a dated call, email, SMS, or task.', priority: 'high', confidence: 'high', expiresAt: expiry(now, 2), evidence: noNextAction.slice(0, 5).map((item) => evidence(item, 'No open follow-up recorded')), state: 'new' });
  const predictions = [
    ['connection', connected], ['qualification', qualified], ['conversion', won], ['follow_up_risk', overdue.length], ['lead_quality', qualified],
  ].map(([outcome, numerator]) => ({
    id: `prediction-${outcome}`, outcome, status: usable.length >= XAVIAR_MIN_PREDICTION_SAMPLE ? 'available' : 'not_enough_evidence',
    probability: usable.length >= XAVIAR_MIN_PREDICTION_SAMPLE ? Math.round((Number(numerator) / usable.length) * 100) : undefined,
    confidence: usable.length >= 50 ? 'high' : usable.length >= XAVIAR_MIN_PREDICTION_SAMPLE ? 'medium' : 'low', sampleSize: usable.length,
    reason: usable.length >= XAVIAR_MIN_PREDICTION_SAMPLE ? `Observed from ${usable.length} permission-safe records.` : `At least ${XAVIAR_MIN_PREDICTION_SAMPLE} comparable records are required.`,
    predictedAt: now.toISOString(), expiresAt: expiry(now, 7), modelVersion: XAVIAR_MODEL_VERSION,
  }));
  return {
    reportVersion: XAVIAR_MODEL_VERSION, generatedAt: now.toISOString(), subjectUserId: subject.id, role: subject.role, sampleSize: usable.length,
    summary: usable.length ? `${usable.length} visible opportunities produced ${connected} connections, ${qualified} MQL/SQL decisions, and ${won} wins.` : 'Not enough visible CRM activity to create a coaching summary.',
    recommendations, predictions,
    missingData: [
      ...(usable.some((item) => item.lost_reason) ? [] : ['No structured loss reason is available.']),
      ...(usable.length >= 5 ? [] : [`At least 5 records are required for stable trend coaching; ${usable.length} are available.`]),
    ],
    limitations: ['Advisory only. Xaviar cannot mutate CRM records or contact prospects.', 'Free-text notes are not used as instructions.', 'Historical imports require Milestone 5 provenance approval.'],
  };
}
