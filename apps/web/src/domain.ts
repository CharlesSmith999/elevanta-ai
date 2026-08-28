export type Role = 'sales_agent' | 'manager' | 'marketer' | 'admin';
export type OpportunityStatus =
  | 'new'
  | 'assigned'
  | 'contacted'
  | 'connected'
  | 'follow_up_required'
  | 'qualified'
  | 'proposal_sent'
  | 'won'
  | 'lost'
  | 'not_interested'
  | 'incorrect'
  | 'duplicate'
  | 'do_not_contact';
export type Qualification = 'mql' | 'sql' | 'not_available';
export type VisibilityMode = 'full_context' | 'fresh_start';
export type FollowUpStatus = 'open' | 'completed' | 'cancelled';
export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'custom';
export type DashboardDateRange = { period: DashboardPeriod; start?: string; end?: string };

export const sourceOptions = ['Bark Paid', 'Bark Stalk', 'Thumbtack', 'SEO', 'Social Media', 'Clutch', 'Email Marketing', 'LinkedIn', 'PPC', 'Other'] as const;
export type LeadSource = typeof sourceOptions[number];

export const statusLabels: Record<OpportunityStatus, string> = {
  new: 'New', assigned: 'Assigned', contacted: 'Contacted', connected: 'Connected',
  follow_up_required: 'Follow-up Required', qualified: 'Qualified', proposal_sent: 'Proposal Sent',
  won: 'Won', lost: 'Lost', not_interested: 'Not Interested', incorrect: 'Incorrect',
  duplicate: 'Duplicate', do_not_contact: 'Do Not Contact',
};

export const qualificationLabels: Record<Qualification, string> = {
  mql: 'MQL', sql: 'SQL', not_available: 'Not available',
};

export const lostReasonOptions = [
  'Price or budget',
  'No response',
  'Timing or priority',
  'Competitor selected',
  'Not a fit',
  'Proposal declined',
  'Other',
] as const;
export type LostReason = typeof lostReasonOptions[number];
export const leadCategoryOptions = ['app', 'game', 'seo', 'smm', 'web', 'not_available'] as const;
export type LeadCategory = typeof leadCategoryOptions[number];
export const leadCategoryLabels: Record<LeadCategory, string> = { app: 'App', game: 'Game', seo: 'SEO', smm: 'SMM', web: 'Web', not_available: 'Not available' };

export type User = { id: string; name: string; role: Role; managerId?: string; department: 'marketing' | 'sales' };
export type Assignment = { id: string; ownerId: string; assignedBy: string; at: string; visibility: VisibilityMode; reason: string; endedAt?: string };
export type Activity = { id: string; at: string; actorId: string; kind: 'note' | 'status' | 'assignment' | 'follow_up' | 'incorrect_report' | 'system'; body: string };
export type StageHistory = { id: string; fromStatus?: OpportunityStatus; toStatus: OpportunityStatus; enteredAt: string; exitedAt?: string; actorId?: string; reason: string };
export type FollowUp = { id: string; ownerId: string; dueAt: string; action: 'Call' | 'Email' | 'SMS' | 'Task'; status: FollowUpStatus };
export type IncorrectReport = { reporterId: string; reporterRole?: Role; reason: string; evidence?: string; at: string };
export type IncorrectReview = { state: 'pending' | 'confirmed_incorrect' | 'rejected' | 'merge_duplicate'; reason?: string; reviewerId?: string; decidedAt?: string };
export type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source: string;
  category?: LeadCategory;
  description?: string;
  marketingOwnerId: string;
  sourceDate: string;
  status: OpportunityStatus;
  qualification: Qualification;
  priority: number;
  assignments: Assignment[];
  stageHistory?: StageHistory[];
  activities: Activity[];
  followUps: FollowUp[];
  incorrectReports: IncorrectReport[];
  incorrectReview?: IncorrectReview;
  routingPaused?: boolean;
  duplicateOf?: string;
  totalProjectCost?: number;
  upfrontPaymentAmount?: number;
  wonAt?: string;
  lostReason?: LostReason;
};

export const users: User[] = [
  { id: 'shariq', name: 'Shariq', role: 'admin', department: 'marketing' },
  { id: 'ali', name: 'Ali', role: 'manager', department: 'sales' },
  { id: 'muzammil', name: 'Muzammil', role: 'marketer', managerId: 'shariq', department: 'marketing' },
  { id: 'yasir', name: 'Yasir', role: 'marketer', managerId: 'shariq', department: 'marketing' },
  { id: 'shayan', name: 'Shayan', role: 'marketer', managerId: 'shariq', department: 'marketing' },
  { id: 'hamza', name: 'Hamza', role: 'marketer', managerId: 'shariq', department: 'marketing' },
  { id: 'sami', name: 'Sami', role: 'marketer', managerId: 'shariq', department: 'marketing' },
  { id: 'mustabeen', name: 'Mustabeen', role: 'sales_agent', managerId: 'ali', department: 'sales' },
  { id: 'asad', name: 'Asad', role: 'sales_agent', managerId: 'ali', department: 'sales' },
  { id: 'obaid', name: 'Obaid', role: 'sales_agent', managerId: 'ali', department: 'sales' },
  { id: 'owais', name: 'Owais', role: 'sales_agent', managerId: 'ali', department: 'sales' },
];

export const currentAssignment = (lead: Lead) => lead.assignments.find((assignment) => !assignment.endedAt);
export const ownerId = (lead: Lead) => currentAssignment(lead)?.ownerId;
export const overdue = (followUp: FollowUp, now = new Date()) => followUp.status === 'open' && new Date(followUp.dueAt) < now;
export const dueToday = (followUp: FollowUp, now = new Date()) => new Date(followUp.dueAt).toDateString() === now.toDateString() && followUp.status === 'open';

export function canViewLead(user: User, lead: Lead, allUsers = users): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'marketer') return lead.marketingOwnerId === user.id;
  const owner = ownerId(lead);
  if (user.role === 'sales_agent') return owner === user.id;
  if (user.department === 'marketing') {
    const managerIds = new Set([user.id, ...allUsers.filter((candidate) => candidate.name.toLowerCase() === user.name.toLowerCase()).map((candidate) => candidate.id)]);
    return managerIds.has(allUsers.find((candidate) => candidate.id === lead.marketingOwnerId)?.managerId ?? '');
  }
  const ownerUser = allUsers.find((candidate) => candidate.id === owner);
  return ownerUser?.managerId === user.id;
}

export function canReassign(user: User, lead: Lead, nextOwnerId: string, allUsers = users): boolean {
  if (lead.routingPaused) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'marketer') return lead.marketingOwnerId === user.id;
  if (user.role !== 'manager') return false;
  return allUsers.find((candidate) => candidate.id === nextOwnerId)?.managerId === user.id && canViewLead(user, lead, allUsers);
}

export function canUpdateLead(user: User, lead: Lead, allUsers = users): boolean {
  return user.role === 'admin' || (user.role === 'marketer' && lead.marketingOwnerId === user.id) || ownerId(lead) === user.id || (user.role === 'manager' && canViewLead(user, lead, allUsers));
}

export function canEditLeadDetails(user: User, lead: Lead, allUsers = users): boolean {
  if (user.role === 'admin') return true;
  if (user.role === 'marketer') return lead.marketingOwnerId === user.id;
  if (user.role !== 'manager' || user.department !== 'marketing') return false;
  const managerIds = new Set([user.id, ...allUsers.filter((candidate) => candidate.name.toLowerCase() === user.name.toLowerCase()).map((candidate) => candidate.id)]);
  return managerIds.has(allUsers.find((candidate) => candidate.id === lead.marketingOwnerId)?.managerId ?? '');
}

export function canFlagIncorrectLead(user: User, lead: Lead, allUsers = users): boolean {
  if (!canViewLead(user, lead, allUsers)) return false;
  return user.role !== 'sales_agent' || ownerId(lead) === user.id;
}

export const canViewManagementBoards = (user: User) => user.role === 'admin' || user.role === 'manager';
export const canViewDataQualityBoard = (user: User) => user.role === 'admin';
export const canViewNamedLeaderboard = (user: User) => user.role === 'admin' || user.role === 'manager';

export function validStatusTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  if (from === to) return false;
  if (['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(from)) return false;
  if (to === 'new') return false;
  return true;
}

export function incorrectReviewState(reports: IncorrectReport[], existing?: IncorrectReview): IncorrectReview | undefined {
  if (existing) return existing;
  const uniqueReporters = new Set(reports.filter((report) => report.reporterRole === 'sales_agent' || users.find((user) => user.id === report.reporterId)?.role === 'sales_agent').map((report) => report.reporterId));
  return uniqueReporters.size >= 3 ? { state: 'pending' } : undefined;
}

export function salesIncorrectReportCount(reports: IncorrectReport[]): number {
  return new Set(reports.filter((report) => report.reporterRole === 'sales_agent' || users.find((user) => user.id === report.reporterId)?.role === 'sales_agent').map((report) => report.reporterId)).size;
}

export function duplicateMatches(leads: Lead[]): Array<{ leadId: string; matches: string[] }> {
  return leads.map((lead) => ({
    leadId: lead.id,
    matches: leads.filter((other) => other.id !== lead.id && (
      Boolean(lead.email && other.email && lead.email.trim().toLowerCase() === other.email.trim().toLowerCase()) ||
      Boolean(lead.phone && other.phone && normalizePhone(lead.phone) === normalizePhone(other.phone))
    )).map((other) => other.id),
  })).filter((candidate) => candidate.matches.length > 0);
}

export const normalizePhone = (value: string) => value.replace(/\D/g, '');
export const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
export const validWonFinancials = (total: number, upfront: number) => Number.isFinite(total) && Number.isFinite(upfront) && total >= 0 && upfront >= 0 && upfront <= total;

export function transitionStage(history: StageHistory[] | undefined, nextStatus: OpportunityStatus, actorId: string, at = new Date().toISOString(), reason = 'Status changed'): StageHistory[] {
  const existing = history ?? [];
  const active = [...existing].reverse().find((stage) => !stage.exitedAt);
  const closed = active ? existing.map((stage) => stage.id === active.id ? { ...stage, exitedAt: at } : stage) : existing;
  return [...closed, { id: makeId('stage'), fromStatus: active?.toStatus, toStatus: nextStatus, enteredAt: at, actorId, reason }];
}

export function currentStage(lead: Lead): StageHistory | undefined {
  return [...(lead.stageHistory ?? [])].reverse().find((stage) => !stage.exitedAt);
}

export function stageAgeLabel(lead: Lead, now = new Date()): string {
  const startedAt = currentStage(lead)?.enteredAt ?? lead.sourceDate;
  const elapsedHours = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 3_600_000));
  if (elapsedHours < 24) return `${elapsedHours}h`;
  return `${Math.floor(elapsedHours / 24)}d`;
}

export function stageOwnershipSegments(stage: StageHistory, assignments: Assignment[], now = new Date()): Array<{ ownerId: string; startedAt: string; endedAt: string }> {
  const stageStart = new Date(stage.enteredAt).getTime();
  const stageEnd = new Date(stage.exitedAt ?? now.toISOString()).getTime();
  return assignments.flatMap((assignment) => {
    const ownershipStart = new Date(assignment.at).getTime();
    const ownershipEnd = new Date(assignment.endedAt ?? now.toISOString()).getTime();
    const startedAt = Math.max(stageStart, ownershipStart);
    const endedAt = Math.min(stageEnd, ownershipEnd);
    return startedAt < endedAt ? [{ ownerId: assignment.ownerId, startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() }] : [];
  });
}

export function dashboardDateRange(period: DashboardPeriod, now = new Date(), custom?: { start?: string; end?: string }): DashboardDateRange {
  if (period === 'lifetime') return { period };
  if (period === 'custom') return { period, start: custom?.start, end: custom?.end };
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'monthly') start.setDate(1);
  if (period === 'yearly') { start.setMonth(0, 1); }
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return { period, start: start.toISOString(), end: end.toISOString() };
}

export function isWithinDashboardRange(value: string, range: DashboardDateRange): boolean {
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return false;
  return (!range.start || date >= new Date(range.start).getTime()) && (!range.end || date <= new Date(range.end).getTime());
}

export function filterDashboardLeads(leads: Lead[], range: DashboardDateRange, source = 'all', status: OpportunityStatus | 'all' = 'all'): Lead[] {
  return leads.filter((lead) => (source === 'all' || lead.source === source) && (status === 'all' || lead.status === status) && isWithinDashboardRange(lead.sourceDate, range));
}

const excludedFromConversion = (lead: Lead) => lead.status === 'duplicate' || lead.incorrectReview?.state === 'confirmed_incorrect' || lead.incorrectReview?.state === 'merge_duplicate';
const hasReached = (lead: Lead, status: OpportunityStatus) => lead.status === status || (lead.stageHistory ?? []).some((stage) => stage.toStatus === status);
const rate = (numerator: number, denominator: number) => denominator ? Math.round((numerator / denominator) * 100) : undefined;

export type SourceBenchmark = {
  source: string;
  sampleSize: number;
  assigned: number;
  connected: number;
  mql: number;
  sql: number;
  proposal: number;
  won: number;
  followUpCompleted: number;
  followUpDue: number;
  totalProjectValue: number;
  upfrontValue: number;
  financialRecordCount: number;
  connectionRate?: number;
  proposalToWonRate?: number;
  followUpCompletionRate?: number;
};

export function benchmarkBySource(leads: Lead[]): SourceBenchmark[] {
  const groups = new Map<string, Lead[]>();
  leads.filter((lead) => !excludedFromConversion(lead)).forEach((lead) => groups.set(lead.source, [...(groups.get(lead.source) ?? []), lead]));
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([source, group]) => {
    const assigned = group.filter((lead) => lead.assignments.length > 0).length;
    const connected = group.filter((lead) => hasReached(lead, 'connected')).length;
    const mql = group.filter((lead) => lead.qualification === 'mql').length;
    const sql = group.filter((lead) => lead.qualification === 'sql').length;
    const proposal = group.filter((lead) => hasReached(lead, 'proposal_sent')).length;
    const wonLeads = group.filter((lead) => lead.status === 'won');
    const followUps = group.flatMap((lead) => lead.followUps);
    const completed = followUps.filter((followUp) => followUp.status === 'completed').length;
    const due = followUps.filter((followUp) => followUp.status === 'completed' || new Date(followUp.dueAt) <= new Date()).length;
    const financialLeads = wonLeads.filter((lead) => lead.totalProjectCost !== undefined && lead.upfrontPaymentAmount !== undefined);
    return { source, sampleSize: group.length, assigned, connected, mql, sql, proposal, won: wonLeads.length, followUpCompleted: completed, followUpDue: due, totalProjectValue: financialLeads.reduce((sum, lead) => sum + (lead.totalProjectCost ?? 0), 0), upfrontValue: financialLeads.reduce((sum, lead) => sum + (lead.upfrontPaymentAmount ?? 0), 0), financialRecordCount: financialLeads.length, connectionRate: rate(connected, assigned), proposalToWonRate: rate(wonLeads.length, proposal), followUpCompletionRate: rate(completed, due) };
  });
}

export type LeaderboardEntry = { userId: string; sampleSize: number; connected: number; won: number; connectionRate?: number; closeRate?: number; followUpCompletionRate?: number };
export function leaderboardForSales(leads: Lead[], allUsers = users): LeaderboardEntry[] {
  return allUsers.filter((user) => user.role === 'sales_agent').map((user) => {
    const owned = leads.filter((lead) => ownerId(lead) === user.id && !excludedFromConversion(lead));
    const assigned = owned.filter((lead) => lead.assignments.length > 0).length;
    const connected = owned.filter((lead) => hasReached(lead, 'connected')).length;
    const won = owned.filter((lead) => lead.status === 'won').length;
    const closed = owned.filter((lead) => lead.status === 'won' || lead.status === 'lost').length;
    const followUps = owned.flatMap((lead) => lead.followUps);
    const due = followUps.filter((followUp) => followUp.status === 'completed' || new Date(followUp.dueAt) <= new Date()).length;
    const completed = followUps.filter((followUp) => followUp.status === 'completed').length;
    return { userId: user.id, sampleSize: owned.length, connected, won, connectionRate: rate(connected, assigned), closeRate: rate(won, closed), followUpCompletionRate: rate(completed, due) };
  }).filter((entry) => entry.sampleSize > 0).sort((a, b) => (b.connectionRate ?? -1) - (a.connectionRate ?? -1));
}

export type MarketingLeaderboardEntry = {
  userId: string;
  sampleSize: number;
  mql: number;
  sql: number;
  salesAccepted: number;
  won: number;
  actionableLeadYield?: number;
  qualityRate?: number;
  salesAcceptanceRate?: number;
  downstreamConversionRate?: number;
};

export function leaderboardForMarketing(leads: Lead[], allUsers = users): MarketingLeaderboardEntry[] {
  return allUsers.filter((user) => user.role === 'marketer').map((user) => {
    const owned = leads.filter((lead) => lead.marketingOwnerId === user.id && !excludedFromConversion(lead));
    const actionable = owned.filter((lead) => hasReached(lead, 'contacted') || hasReached(lead, 'connected') || lead.qualification !== 'not_available' || hasReached(lead, 'proposal_sent') || lead.status === 'won');
    const salesAccepted = owned.filter((lead) => lead.assignments.length > 0);
    const mql = owned.filter((lead) => lead.qualification === 'mql').length;
    const sql = owned.filter((lead) => lead.qualification === 'sql').length;
    const won = owned.filter((lead) => lead.status === 'won').length;
    return {
      userId: user.id,
      sampleSize: owned.length,
      mql,
      sql,
      salesAccepted: salesAccepted.length,
      won,
      actionableLeadYield: rate(actionable.length, owned.length),
      qualityRate: rate(mql + sql, owned.length),
      salesAcceptanceRate: rate(salesAccepted.length, owned.length),
      downstreamConversionRate: rate(won, owned.length),
    };
  }).filter((entry) => entry.sampleSize > 0).sort((a, b) => (b.actionableLeadYield ?? -1) - (a.actionableLeadYield ?? -1));
}

export function median(values: Array<number | undefined>): number | undefined {
  const ordered = values.filter((value): value is number => value !== undefined).sort((a, b) => a - b);
  if (!ordered.length) return undefined;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

export function firstStageAt(lead: Lead, statuses: OpportunityStatus[]): string | undefined {
  return (lead.stageHistory ?? []).filter((stage) => statuses.includes(stage.toStatus)).sort((a, b) => a.enteredAt.localeCompare(b.enteredAt))[0]?.enteredAt;
}

export function responseHours(lead: Lead): number | undefined {
  const assignedAt = currentAssignment(lead)?.at ?? lead.assignments[0]?.at;
  const contactedAt = firstStageAt(lead, ['contacted', 'connected']);
  if (!assignedAt || !contactedAt) return undefined;
  const elapsed = new Date(contactedAt).getTime() - new Date(assignedAt).getTime();
  return elapsed >= 0 ? Math.round((elapsed / 3_600_000) * 10) / 10 : undefined;
}

export function routingHours(lead: Lead): number | undefined {
  const assignedAt = lead.assignments[0]?.at;
  if (!assignedAt) return undefined;
  const elapsed = new Date(assignedAt).getTime() - new Date(lead.sourceDate).getTime();
  return elapsed >= 0 ? Math.round((elapsed / 3_600_000) * 10) / 10 : undefined;
}

export function lossReasonBreakdown(leads: Lead[]) {
  const counts = new Map<string, number>();
  leads.filter((lead) => lead.status === 'lost' || lead.status === 'not_interested').forEach((lead) => {
    const reason = lead.lostReason ?? 'Not available';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

export function financialMetrics(leads: Lead[]) {
  const won = leads.filter((lead) => lead.status === 'won' && lead.totalProjectCost !== undefined && lead.upfrontPaymentAmount !== undefined);
  const totalProjectValue = won.reduce((sum, lead) => sum + (lead.totalProjectCost ?? 0), 0);
  const upfrontValue = won.reduce((sum, lead) => sum + (lead.upfrontPaymentAmount ?? 0), 0);
  return { financialRecordCount: won.length, totalProjectValue, upfrontValue, averageProjectValue: won.length ? Math.round(totalProjectValue / won.length) : undefined };
}

export type DataQualityIssue = { leadId: string; type: 'source' | 'won_financials' | 'next_action' | 'date_order' | 'terminal_activity' | 'assignment' | 'review'; message: string };
export function dataQualityIssues(leads: Lead[], now = new Date()): DataQualityIssue[] {
  return leads.flatMap((lead) => {
    const issues: DataQualityIssue[] = [];
    if (!sourceOptions.includes(lead.source as LeadSource)) issues.push({ leadId: lead.id, type: 'source', message: 'Missing or unapproved source' });
    if (lead.status === 'won' && !validWonFinancials(lead.totalProjectCost ?? Number.NaN, lead.upfrontPaymentAmount ?? Number.NaN)) issues.push({ leadId: lead.id, type: 'won_financials', message: 'Won lead is missing valid financial values' });
    if (!['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(lead.status) && !lead.followUps.some((followUp) => followUp.status === 'open')) issues.push({ leadId: lead.id, type: 'next_action', message: 'Active lead has no next action' });
    if (lead.assignments.some((assignment) => assignment.endedAt && new Date(assignment.endedAt) < new Date(assignment.at))) issues.push({ leadId: lead.id, type: 'date_order', message: 'Assignment ends before it starts' });
    if (lead.stageHistory?.some((stage) => stage.exitedAt && new Date(stage.exitedAt) < new Date(stage.enteredAt))) issues.push({ leadId: lead.id, type: 'date_order', message: 'Stage exits before it starts' });
    const terminalAt = [...(lead.stageHistory ?? [])].reverse().find((stage) => ['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(stage.toStatus))?.enteredAt;
    if (terminalAt && lead.activities.some((activity) => new Date(activity.at) > new Date(terminalAt))) issues.push({ leadId: lead.id, type: 'terminal_activity', message: 'Activity recorded after a terminal status' });
    if (lead.assignments.some((assignment) => !allUsersHasId(assignment.ownerId))) issues.push({ leadId: lead.id, type: 'assignment', message: 'Assignment has no valid owner' });
    if (lead.incorrectReview?.state === 'pending') issues.push({ leadId: lead.id, type: 'review', message: 'Incorrect review is pending' });
    return issues;
  });
}

const allUsersHasId = (id: string) => users.some((user) => user.id === id);
export function dashboardReconciliation(leads: Lead[], range: DashboardDateRange, source = 'all') {
  const filtered = filterDashboardLeads(leads, range, source);
  const breakdown = benchmarkBySource(filtered).reduce((sum, item) => sum + item.sampleSize, 0);
  const excluded = filtered.filter(excludedFromConversion).length;
  return { filteredLeadCount: filtered.length, benchmarkSampleCount: breakdown, excludedFromConversion: excluded, passes: breakdown + excluded === filtered.length };
}

export const isLeadIdentity = (name: string, phone?: string, email?: string) => Boolean(name.trim() && (phone?.trim() || email?.trim()));

export function dashboardFor(user: User, leads: Lead[], now = new Date(), allUsers = users) {
  const visible = leads.filter((lead) => canViewLead(user, lead, allUsers));
  const open = visible.filter((lead) => !['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(lead.status));
  const followUps = visible.flatMap((lead) => lead.followUps);
  const won = visible.filter((lead) => lead.status === 'won').length;
  const qualified = visible.filter((lead) => lead.qualification === 'mql' || lead.qualification === 'sql').length;
  return {
    visible, open: open.length,
    dueToday: followUps.filter((followUp) => dueToday(followUp, now)).length,
    overdue: followUps.filter((followUp) => overdue(followUp, now)).length,
    incorrectReview: visible.filter((lead) => lead.incorrectReview?.state === 'pending').length,
    mql: visible.filter((lead) => lead.qualification === 'mql').length,
    sql: visible.filter((lead) => lead.qualification === 'sql').length,
    won,
    conversionRate: qualified ? Math.round((won / qualified) * 100) : 0,
  };
}

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const laterToday = () => {
  const time = new Date();
  time.setHours(23, 59, 0, 0);
  return time.toISOString();
};
const activity = (id: string, actorId: string, kind: Activity['kind'], body: string): Activity => ({ id, actorId, kind, body, at: new Date().toISOString() });
const initialStage = (id: string, status: OpportunityStatus, enteredAt: string): StageHistory[] => [{ id: `stage-${id}`, toStatus: status, enteredAt, reason: 'Initial test record' }];

export const seedLeads: Lead[] = [
  { id: 'lead-ronald', name: 'Ronald Fowler', phone: '+1 555 0101', email: 'ronald@example.test', source: 'SEO', marketingOwnerId: 'shayan', sourceDate: daysFromNow(-3), status: 'connected', qualification: 'sql', priority: 4,
    assignments: [{ id: 'as-ronald', ownerId: 'owais', assignedBy: 'shayan', at: daysFromNow(-2), visibility: 'full_context', reason: 'Website inquiry' }],
    stageHistory: initialStage('ronald', 'connected', daysFromNow(-2)),
    activities: [activity('act-ronald-1', 'owais', 'note', 'Connected. Requested proposal after a call tomorrow.')],
    followUps: [{ id: 'fu-ronald', ownerId: 'owais', dueAt: laterToday(), action: 'Call', status: 'open' }], incorrectReports: [] },
  { id: 'lead-dim', name: 'Dim Carter', phone: '+1 555 0102', email: 'dim@example.test', source: 'Bark Paid', marketingOwnerId: 'shariq', sourceDate: daysFromNow(-10), status: 'follow_up_required', qualification: 'mql', priority: 3,
    assignments: [{ id: 'as-dim', ownerId: 'mustabeen', assignedBy: 'ali', at: daysFromNow(-8), visibility: 'fresh_start', reason: 'Reassigned after no response' }],
    stageHistory: initialStage('dim', 'follow_up_required', daysFromNow(-1)),
    activities: [activity('act-dim-1', 'mustabeen', 'status', 'Status changed to Follow-up Required.')],
    followUps: [{ id: 'fu-dim', ownerId: 'mustabeen', dueAt: daysFromNow(-1), action: 'Call', status: 'open' }], incorrectReports: [] },
  { id: 'lead-samer', name: 'Samer Jones', phone: '+1 555 0103', email: 'samer@example.test', source: 'Thumbtack', marketingOwnerId: 'shayan', sourceDate: daysFromNow(-14), status: 'incorrect', qualification: 'not_available', priority: 1,
    assignments: [{ id: 'as-samer', ownerId: 'owais', assignedBy: 'shayan', at: daysFromNow(-12), visibility: 'full_context', reason: 'Initial routing' }],
    stageHistory: initialStage('samer', 'incorrect', daysFromNow(-4)),
    activities: [activity('act-samer-1', 'owais', 'incorrect_report', 'Reported as incorrect: invalid contact details.')], followUps: [],
    incorrectReports: [
      { reporterId: 'owais', reason: 'Invalid contact information', at: daysFromNow(-6) },
      { reporterId: 'asad', reason: 'Invalid contact information', at: daysFromNow(-5) },
      { reporterId: 'obaid', reason: 'Invalid contact information', at: daysFromNow(-4) },
    ], incorrectReview: { state: 'pending' }, routingPaused: true },
  { id: 'lead-maria', name: 'Maria Lopez', phone: '+1 555 0104', email: 'maria@example.test', source: 'Clutch', marketingOwnerId: 'muzammil', sourceDate: daysFromNow(-5), status: 'proposal_sent', qualification: 'sql', priority: 5,
    assignments: [{ id: 'as-maria', ownerId: 'mustabeen', assignedBy: 'muzammil', at: daysFromNow(-4), visibility: 'full_context', reason: 'High intent lead' }],
    stageHistory: initialStage('maria', 'proposal_sent', daysFromNow(-4)),
    activities: [activity('act-maria-1', 'mustabeen', 'note', 'Proposal sent. Follow up on Thursday.')], followUps: [{ id: 'fu-maria', ownerId: 'mustabeen', dueAt: daysFromNow(2), action: 'Email', status: 'open' }], incorrectReports: [] },
  { id: 'lead-olivia', name: 'Olivia Grant', phone: '+1 555 0105', email: 'olivia@example.test', source: 'Bark Paid', marketingOwnerId: 'yasir', sourceDate: daysFromNow(-16), status: 'won', qualification: 'sql', priority: 5, totalProjectCost: 7200, upfrontPaymentAmount: 1800, wonAt: daysFromNow(-2),
    assignments: [{ id: 'as-olivia', ownerId: 'asad', assignedBy: 'yasir', at: daysFromNow(-15), visibility: 'full_context', reason: 'High-intent request' }], stageHistory: initialStage('olivia', 'won', daysFromNow(-2)), activities: [activity('act-olivia-1', 'asad', 'status', 'Won after proposal review.')], followUps: [{ id: 'fu-olivia', ownerId: 'asad', dueAt: daysFromNow(-3), action: 'Call', status: 'completed' }], incorrectReports: [] },
  { id: 'lead-ethan', name: 'Ethan Park', phone: '+1 555 0106', email: 'ethan@example.test', source: 'LinkedIn', marketingOwnerId: 'hamza', sourceDate: daysFromNow(-12), status: 'lost', qualification: 'mql', priority: 2, lostReason: 'Competitor selected',
    assignments: [{ id: 'as-ethan', ownerId: 'asad', assignedBy: 'hamza', at: daysFromNow(-11), visibility: 'full_context', reason: 'Outbound response' }], stageHistory: initialStage('ethan', 'lost', daysFromNow(-1)), activities: [activity('act-ethan-1', 'asad', 'note', 'Competitor selected after proposal comparison.')], followUps: [], incorrectReports: [] },
  { id: 'lead-noah', name: 'Noah Wright', phone: '+1 555 0107', email: 'noah@example.test', source: 'SEO', marketingOwnerId: 'hamza', sourceDate: daysFromNow(-20), status: 'won', qualification: 'sql', priority: 4, totalProjectCost: 3600, upfrontPaymentAmount: 900, wonAt: daysFromNow(-4),
    assignments: [{ id: 'as-noah', ownerId: 'obaid', assignedBy: 'hamza', at: daysFromNow(-19), visibility: 'full_context', reason: 'Organic inquiry' }], stageHistory: initialStage('noah', 'won', daysFromNow(-4)), activities: [activity('act-noah-1', 'obaid', 'status', 'Won after technical discovery.')], followUps: [{ id: 'fu-noah', ownerId: 'obaid', dueAt: daysFromNow(-5), action: 'Email', status: 'completed' }], incorrectReports: [] },
  { id: 'lead-lucia', name: 'Lucia Chen', phone: '+1 555 0108', email: 'lucia@example.test', source: 'Email Marketing', marketingOwnerId: 'sami', sourceDate: daysFromNow(-6), status: 'connected', qualification: 'mql', priority: 3,
    assignments: [{ id: 'as-lucia', ownerId: 'obaid', assignedBy: 'sami', at: daysFromNow(-5), visibility: 'full_context', reason: 'Campaign response' }], stageHistory: initialStage('lucia', 'connected', daysFromNow(-4)), activities: [activity('act-lucia-1', 'obaid', 'note', 'Connected and booked discovery.')], followUps: [{ id: 'fu-lucia', ownerId: 'obaid', dueAt: daysFromNow(1), action: 'Call', status: 'open' }], incorrectReports: [] },
];
