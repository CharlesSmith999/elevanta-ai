import {
  Lead, OpportunityStatus, User, canViewLead, currentAssignment, duplicateMatches,
  firstStageAt, leaderboardForMarketing, leaderboardForSales, lossReasonBreakdown,
  overdue, responseHours, routingHours, users,
} from './domain';

export type XaviarPeriod = 'daily' | 'weekly' | 'monthly' | 'lifetime';
export type XaviarConfidence = 'low' | 'medium' | 'high';
export type XaviarRecommendationState = 'new' | 'acknowledged' | 'deferred' | 'completed' | 'dismissed';
export type XaviarCapability = 'explain' | 'recommend' | 'coach' | 'benchmark' | 'predict';

export type XaviarEvidence = {
  id: string;
  kind: 'opportunity' | 'activity' | 'follow_up' | 'metric';
  label: string;
  occurredAt?: string;
  opportunityId?: string;
};

export type XaviarRecommendation = {
  id: string;
  capability: XaviarCapability;
  title: string;
  reason: string;
  action: string;
  confidence: XaviarConfidence;
  priority: 'high' | 'medium' | 'low';
  expiresAt: string;
  evidence: XaviarEvidence[];
  state: XaviarRecommendationState;
};

export type XaviarPrediction = {
  id: string;
  outcome: 'connection' | 'qualification' | 'conversion' | 'follow_up_risk' | 'lead_quality';
  status: 'available' | 'not_enough_evidence';
  probability?: number;
  confidence: XaviarConfidence;
  reason: string;
  sampleSize: number;
  modelVersion: string;
  predictedAt: string;
  expiresAt: string;
  evidence: XaviarEvidence[];
};

export type XaviarReport = {
  reportVersion: string;
  generatedAt: string;
  viewerId: string;
  role: User['role'];
  period: XaviarPeriod;
  scope: 'personal' | 'team' | 'company';
  sampleSize: number;
  summary: string;
  strengths: string[];
  risks: string[];
  missingData: string[];
  recommendations: XaviarRecommendation[];
  predictions: XaviarPrediction[];
  benchmark: { status: 'available' | 'not_enough_evidence'; label: string; value?: number; sampleSize: number; privacy: string };
  limitations: string[];
};

export const XAVIAR_REPORT_VERSION = 'xaviar-rules-1.0.0';
export const XAVIAR_MIN_TREND_SAMPLE = 5;
export const XAVIAR_MIN_BENCHMARK_SAMPLE = 10;
export const XAVIAR_MIN_PREDICTION_SAMPLE = 20;

const terminalStatuses: OpportunityStatus[] = ['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'];
const pct = (value: number, total: number) => total ? Math.round((value / total) * 100) : 0;
const expires = (now: Date, days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
const evidenceFor = (lead: Lead, label: string): XaviarEvidence => ({ id: `opportunity:${lead.id}`, kind: 'opportunity', label, occurredAt: lead.sourceDate, opportunityId: lead.id });
const metricEvidence = (id: string, label: string): XaviarEvidence => ({ id: `metric:${id}`, kind: 'metric', label });

function rangeStart(period: XaviarPeriod, now: Date): number | undefined {
  if (period === 'lifetime') return undefined;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - 6);
  if (period === 'monthly') start.setDate(start.getDate() - 29);
  return start.getTime();
}

export function xaviarVisibleLeads(viewer: User, leads: Lead[], period: XaviarPeriod, now = new Date()): Lead[] {
  const start = rangeStart(period, now);
  const managerAliases = new Set([viewer.id, ...users.filter((candidate) => candidate.name.toLowerCase() === viewer.name.toLowerCase()).map((candidate) => candidate.id)]);
  return leads.filter((lead) => {
    const marketingManagerAccess = viewer.role === 'manager' && viewer.department === 'marketing'
      && managerAliases.has(users.find((candidate) => candidate.id === lead.marketingOwnerId)?.managerId ?? '');
    return (marketingManagerAccess || canViewLead(viewer, lead, users)) && (start === undefined || new Date(lead.sourceDate).getTime() >= start);
  });
}

function priorityRecommendations(viewer: User, leads: Lead[], now: Date): XaviarRecommendation[] {
  const recommendations: XaviarRecommendation[] = [];
  const overdueLeads = leads.filter((lead) => lead.followUps.some((item) => overdue(item, now)));
  if (overdueLeads.length) recommendations.push({
    id: 'follow-up-overdue', capability: 'recommend', title: 'Recover overdue follow-ups',
    reason: `${overdueLeads.length} visible ${overdueLeads.length === 1 ? 'opportunity has' : 'opportunities have'} an overdue next action.`,
    action: 'Complete or reschedule the overdue items before adding new follow-ups.', confidence: 'high', priority: 'high',
    expiresAt: expires(now, 1), evidence: overdueLeads.slice(0, 5).map((lead) => evidenceFor(lead, 'Overdue follow-up recorded')), state: 'new',
  });

  const stalled = leads.filter((lead) => !terminalStatuses.includes(lead.status) && !lead.followUps.some((item) => item.status === 'open'));
  if (stalled.length) recommendations.push({
    id: 'missing-next-action', capability: 'recommend', title: 'Give active leads a next action',
    reason: `${stalled.length} active ${stalled.length === 1 ? 'opportunity has' : 'opportunities have'} no open follow-up.`,
    action: 'Add a dated call, email, SMS, or task to each active opportunity.', confidence: 'high', priority: 'high',
    expiresAt: expires(now, 2), evidence: stalled.slice(0, 5).map((lead) => evidenceFor(lead, 'Active opportunity without an open follow-up')), state: 'new',
  });

  if (viewer.role === 'sales_agent' || (viewer.role === 'manager' && viewer.department === 'sales') || viewer.role === 'admin') {
    const proposalRisk = leads.filter((lead) => lead.status === 'proposal_sent' && !lead.followUps.some((item) => item.status === 'open'));
    if (proposalRisk.length) recommendations.push({
      id: 'proposal-follow-up', capability: 'coach', title: 'Protect proposal momentum',
      reason: `${proposalRisk.length} proposal ${proposalRisk.length === 1 ? 'is' : 'are'} open without a scheduled next step.`,
      action: 'Schedule a specific proposal follow-up and record the buyer’s remaining decision concern.', confidence: 'high', priority: 'high',
      expiresAt: expires(now, 2), evidence: proposalRisk.map((lead) => evidenceFor(lead, 'Proposal without scheduled follow-up')), state: 'new',
    });
    const losses = lossReasonBreakdown(leads);
    if (losses.length) recommendations.push({
      id: 'loss-pattern', capability: 'coach', title: 'Learn from the leading loss reason',
      reason: `${losses[0].reason} is the most recorded loss reason in this view (${losses[0].count}).`,
      action: 'Review the matching opportunities and agree one qualification or follow-up change to test next.', confidence: losses[0].count >= 3 ? 'medium' : 'low', priority: 'medium',
      expiresAt: expires(now, 14), evidence: [metricEvidence('loss-reason', `${losses[0].count} recorded losses: ${losses[0].reason}`)], state: 'new',
    });
  }

  if (viewer.role === 'marketer' || (viewer.role === 'manager' && viewer.department === 'marketing') || viewer.role === 'admin') {
    const duplicates = duplicateMatches(leads);
    if (duplicates.length) recommendations.push({
      id: 'duplicate-prevention', capability: 'coach', title: 'Reduce duplicate lead effort',
      reason: `${duplicates.length} visible records have an exact email or phone duplicate candidate.`,
      action: 'Review duplicate candidates before routing and check the source intake rule that created them.', confidence: 'high', priority: 'medium',
      expiresAt: expires(now, 7), evidence: duplicates.slice(0, 5).map((item) => ({ id: `opportunity:${item.leadId}`, kind: 'opportunity', label: 'Exact contact duplicate candidate', opportunityId: item.leadId })), state: 'new',
    });
    const unrouted = leads.filter((lead) => !currentAssignment(lead));
    if (unrouted.length) recommendations.push({
      id: 'routing-delay', capability: 'recommend', title: 'Route unassigned leads',
      reason: `${unrouted.length} visible ${unrouted.length === 1 ? 'lead is' : 'leads are'} waiting without a sales owner.`,
      action: 'Validate contact details, then assign an appropriate sales owner.', confidence: 'high', priority: 'high',
      expiresAt: expires(now, 1), evidence: unrouted.slice(0, 5).map((lead) => evidenceFor(lead, 'No active sales assignment')), state: 'new',
    });
  }
  return recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])).slice(0, 6);
}

function prediction(outcome: XaviarPrediction['outcome'], numerator: number, sampleSize: number, now: Date, evidenceLabel: string): XaviarPrediction {
  const available = sampleSize >= XAVIAR_MIN_PREDICTION_SAMPLE;
  return {
    id: `prediction-${outcome}`, outcome, status: available ? 'available' : 'not_enough_evidence',
    probability: available ? pct(numerator, sampleSize) : undefined,
    confidence: sampleSize >= 50 ? 'high' : sampleSize >= XAVIAR_MIN_PREDICTION_SAMPLE ? 'medium' : 'low',
    reason: available ? `Observed rate from ${sampleSize} comparable visible records.` : `At least ${XAVIAR_MIN_PREDICTION_SAMPLE} comparable records are required; ${sampleSize} are available.`,
    sampleSize, modelVersion: XAVIAR_REPORT_VERSION, predictedAt: now.toISOString(), expiresAt: expires(now, 7),
    evidence: [metricEvidence(outcome, evidenceLabel)],
  };
}

export function buildXaviarReport(viewer: User, allLeads: Lead[], period: XaviarPeriod = 'weekly', now = new Date()): XaviarReport {
  const leads = xaviarVisibleLeads(viewer, allLeads, period, now).filter((lead) => lead.status !== 'duplicate' && lead.incorrectReview?.state !== 'confirmed_incorrect');
  const connected = leads.filter((lead) => Boolean(firstStageAt(lead, ['connected'])) || lead.status === 'connected').length;
  const qualified = leads.filter((lead) => lead.qualification === 'mql' || lead.qualification === 'sql').length;
  const won = leads.filter((lead) => lead.status === 'won').length;
  const overdueCount = leads.flatMap((lead) => lead.followUps).filter((item) => overdue(item, now)).length;
  const responseSamples = leads.map(responseHours).filter((value): value is number => value !== undefined);
  const routingSamples = leads.map(routingHours).filter((value): value is number => value !== undefined);
  const noteCount = leads.flatMap((lead) => lead.activities).filter((item) => item.kind === 'note').length;
  const missingData: string[] = [];
  if (responseSamples.length < XAVIAR_MIN_TREND_SAMPLE) missingData.push(`Response-speed coaching needs ${XAVIAR_MIN_TREND_SAMPLE} timestamped samples; ${responseSamples.length} are available.`);
  if (routingSamples.length < XAVIAR_MIN_TREND_SAMPLE) missingData.push(`Routing coaching needs ${XAVIAR_MIN_TREND_SAMPLE} timestamped samples; ${routingSamples.length} are available.`);
  if (!leads.some((lead) => lead.status === 'lost' && lead.lostReason)) missingData.push('No structured lost reason is available in this view.');
  if (!noteCount) missingData.push('No agent-authored notes are available for note-completeness coaching.');

  const strengths: string[] = [];
  const risks: string[] = [];
  if (!overdueCount && leads.length) strengths.push('No visible follow-up is overdue.');
  if (pct(qualified, leads.length) >= 40) strengths.push(`${pct(qualified, leads.length)}% of visible records reached MQL or SQL.`);
  if (won) strengths.push(`${won} visible ${won === 1 ? 'opportunity is' : 'opportunities are'} recorded as won.`);
  if (overdueCount) risks.push(`${overdueCount} follow-up ${overdueCount === 1 ? 'is' : 'are'} overdue.`);
  const withoutNextAction = leads.filter((lead) => !terminalStatuses.includes(lead.status) && !lead.followUps.some((item) => item.status === 'open')).length;
  if (withoutNextAction) risks.push(`${withoutNextAction} active ${withoutNextAction === 1 ? 'opportunity has' : 'opportunities have'} no next action.`);

  const marketingBenchmark = viewer.role === 'marketer' || (viewer.role === 'manager' && viewer.department === 'marketing');
  const marketingBoard = marketingBenchmark ? leaderboardForMarketing(leads) : [];
  const salesBoard = marketingBenchmark ? [] : leaderboardForSales(leads);
  const benchmarkSamples = marketingBenchmark
    ? marketingBoard.reduce((sum, row) => sum + row.sampleSize, 0)
    : salesBoard.reduce((sum, row) => sum + row.sampleSize, 0);
  const boardLength = marketingBenchmark ? marketingBoard.length : salesBoard.length;
  const benchmarkAvailable = benchmarkSamples >= XAVIAR_MIN_BENCHMARK_SAMPLE && boardLength >= 2;
  const benchmarkValue = !benchmarkAvailable ? undefined : marketingBenchmark
    ? Math.round(marketingBoard.reduce((sum, row) => sum + (row.actionableLeadYield ?? 0), 0) / marketingBoard.length)
    : Math.round(salesBoard.reduce((sum, row) => sum + (row.connectionRate ?? 0), 0) / salesBoard.length);

  const scope = viewer.role === 'admin' ? 'company' : viewer.role === 'manager' ? 'team' : 'personal';
  return {
    reportVersion: XAVIAR_REPORT_VERSION, generatedAt: now.toISOString(), viewerId: viewer.id, role: viewer.role, period, scope,
    sampleSize: leads.length,
    summary: leads.length ? `${leads.length} visible opportunities produced ${connected} connections, ${qualified} MQL/SQL decisions, and ${won} wins in this ${period} view.` : 'There is not enough visible CRM activity to create a coaching summary for this period.',
    strengths: strengths.length ? strengths : ['Not enough evidence to identify a reliable strength yet.'],
    risks: risks.length ? risks : ['No immediate evidence-backed risk was detected in the visible records.'],
    missingData,
    recommendations: priorityRecommendations(viewer, leads, now),
    predictions: [
      prediction('connection', connected, leads.length, now, `${connected} of ${leads.length} visible records connected`),
      prediction('qualification', qualified, leads.length, now, `${qualified} of ${leads.length} visible records reached MQL or SQL`),
      prediction('conversion', won, leads.length, now, `${won} of ${leads.length} visible records were won`),
      prediction('follow_up_risk', overdueCount, Math.max(leads.length, overdueCount), now, `${overdueCount} overdue follow-ups across ${leads.length} visible records`),
      prediction('lead_quality', qualified, leads.length, now, `${qualified} qualified records across ${leads.length} visible records`),
    ],
    benchmark: {
      status: benchmarkAvailable ? 'available' : 'not_enough_evidence', label: marketingBenchmark ? 'Actionable lead yield' : 'Connection rate',
      value: benchmarkValue, sampleSize: benchmarkSamples,
      privacy: viewer.role === 'admin' || viewer.role === 'manager' ? 'Named results are limited to permitted teams.' : 'Peer identities and contact records are hidden.',
    },
    limitations: [
      'Xaviar is advisory and cannot change records, reassign leads, merge duplicates, or contact prospects.',
      'Recommendations use structured CRM events only. Instructions inside free-text notes are never treated as commands.',
      'Historical imported data is excluded from behavioral coaching until Milestone 5 provenance checks pass.',
    ],
  };
}

export function updateRecommendationState(recommendation: XaviarRecommendation, state: XaviarRecommendationState): XaviarRecommendation {
  return { ...recommendation, state };
}

export function brierScore(cases: Array<{ probability: number; outcome: 0 | 1 }>): number | undefined {
  if (!cases.length) return undefined;
  return Math.round((cases.reduce((sum, item) => sum + (item.probability - item.outcome) ** 2, 0) / cases.length) * 10_000) / 10_000;
}
