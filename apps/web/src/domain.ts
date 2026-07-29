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

export type User = { id: string; name: string; role: Role; managerId?: string; department: 'marketing' | 'sales' };
export type Assignment = { id: string; ownerId: string; assignedBy: string; at: string; visibility: VisibilityMode; reason: string; endedAt?: string };
export type Activity = { id: string; at: string; actorId: string; kind: 'note' | 'status' | 'assignment' | 'follow_up' | 'incorrect_report' | 'system'; body: string };
export type FollowUp = { id: string; ownerId: string; dueAt: string; action: 'Call' | 'Email' | 'SMS' | 'Task'; status: FollowUpStatus };
export type IncorrectReport = { reporterId: string; reason: string; evidence?: string; at: string };
export type IncorrectReview = { state: 'pending' | 'confirmed_incorrect' | 'rejected' | 'merge_duplicate'; reason?: string; reviewerId?: string; decidedAt?: string };
export type Lead = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source: string;
  marketingOwnerId: string;
  sourceDate: string;
  status: OpportunityStatus;
  qualification: Qualification;
  priority: number;
  assignments: Assignment[];
  activities: Activity[];
  followUps: FollowUp[];
  incorrectReports: IncorrectReport[];
  incorrectReview?: IncorrectReview;
  routingPaused?: boolean;
  duplicateOf?: string;
  totalProjectCost?: number;
  upfrontPaymentAmount?: number;
  wonAt?: string;
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

export function validStatusTransition(from: OpportunityStatus, to: OpportunityStatus): boolean {
  if (from === to) return false;
  if (['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'].includes(from)) return false;
  if (to === 'new') return false;
  return true;
}

export function incorrectReviewState(reports: IncorrectReport[], existing?: IncorrectReview): IncorrectReview | undefined {
  if (existing) return existing;
  const uniqueReporters = new Set(reports.map((report) => report.reporterId));
  return uniqueReporters.size >= 3 ? { state: 'pending' } : undefined;
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

export const isLeadIdentity = (name: string, phone?: string, email?: string) => Boolean(name.trim() && (phone?.trim() || email?.trim()));

export function dashboardFor(user: User, leads: Lead[], now = new Date()) {
  const visible = leads.filter((lead) => canViewLead(user, lead));
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

export const seedLeads: Lead[] = [
  { id: 'lead-ronald', name: 'Ronald Fowler', phone: '+1 555 0101', email: 'ronald@example.test', source: 'SEO', marketingOwnerId: 'shayan', sourceDate: '2025-08-01', status: 'connected', qualification: 'sql', priority: 4,
    assignments: [{ id: 'as-ronald', ownerId: 'owais', assignedBy: 'shayan', at: daysFromNow(-2), visibility: 'full_context', reason: 'Website inquiry' }],
    activities: [activity('act-ronald-1', 'owais', 'note', 'Connected. Requested proposal after a call tomorrow.')],
    followUps: [{ id: 'fu-ronald', ownerId: 'owais', dueAt: laterToday(), action: 'Call', status: 'open' }], incorrectReports: [] },
  { id: 'lead-dim', name: 'Dim Carter', phone: '+1 555 0102', email: 'dim@example.test', source: 'Bark Paid', marketingOwnerId: 'shariq', sourceDate: '2025-08-01', status: 'follow_up_required', qualification: 'mql', priority: 3,
    assignments: [{ id: 'as-dim', ownerId: 'mustabeen', assignedBy: 'ali', at: daysFromNow(-8), visibility: 'fresh_start', reason: 'Reassigned after no response' }],
    activities: [activity('act-dim-1', 'mustabeen', 'status', 'Status changed to Follow-up Required.')],
    followUps: [{ id: 'fu-dim', ownerId: 'mustabeen', dueAt: daysFromNow(-1), action: 'Call', status: 'open' }], incorrectReports: [] },
  { id: 'lead-samer', name: 'Samer Jones', phone: '+1 555 0103', email: 'samer@example.test', source: 'Thumbtack', marketingOwnerId: 'shayan', sourceDate: '2025-08-01', status: 'incorrect', qualification: 'not_available', priority: 1,
    assignments: [{ id: 'as-samer', ownerId: 'owais', assignedBy: 'shayan', at: daysFromNow(-12), visibility: 'full_context', reason: 'Initial routing' }],
    activities: [activity('act-samer-1', 'owais', 'incorrect_report', 'Reported as incorrect: invalid contact details.')], followUps: [],
    incorrectReports: [
      { reporterId: 'owais', reason: 'Invalid contact information', at: daysFromNow(-6) },
      { reporterId: 'asad', reason: 'Invalid contact information', at: daysFromNow(-5) },
      { reporterId: 'obaid', reason: 'Invalid contact information', at: daysFromNow(-4) },
    ], incorrectReview: { state: 'pending' }, routingPaused: true },
  { id: 'lead-maria', name: 'Maria Lopez', phone: '+1 555 0104', email: 'maria@example.test', source: 'Clutch', marketingOwnerId: 'muzammil', sourceDate: '2025-08-01', status: 'proposal_sent', qualification: 'sql', priority: 5,
    assignments: [{ id: 'as-maria', ownerId: 'mustabeen', assignedBy: 'muzammil', at: daysFromNow(-4), visibility: 'full_context', reason: 'High intent lead' }],
    activities: [activity('act-maria-1', 'mustabeen', 'note', 'Proposal sent. Follow up on Thursday.')], followUps: [{ id: 'fu-maria', ownerId: 'mustabeen', dueAt: daysFromNow(2), action: 'Email', status: 'open' }], incorrectReports: [] },
];
