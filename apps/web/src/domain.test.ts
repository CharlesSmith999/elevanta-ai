import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkBySource, canEditLeadDetails, canFlagIncorrectLead, canReassign, canUpdateLead, canViewDataQualityBoard, canViewLead, canViewManagementBoards, canViewNamedLeaderboard, dashboardDateRange, dashboardFor, dashboardReconciliation, dataQualityIssues, duplicateMatches, dueToday, filterDashboardLeads, financialMetrics, incorrectReviewState, isLeadIdentity, leadCategoryLabels, leadCategoryOptions, leaderboardForMarketing, leaderboardForSales, lossReasonBreakdown, overdue, responseHours, routingHours, salesIncorrectReportCount, seedLeads, sourceOptions, stageOwnershipSegments, transitionStage, users, validStatusTransition, validWonFinancials } from './domain.js';

const user = (id: string) => users.find((candidate) => candidate.id === id)!;

test('sales agents cannot view another agent’s contact', () => {
  assert.equal(canViewLead(user('owais'), seedLeads.find((lead) => lead.id === 'lead-dim')!), false);
});

test('a manager can view their team but not reassign a routing-paused lead', () => {
  assert.equal(canViewLead(user('ali'), seedLeads.find((lead) => lead.id === 'lead-dim')!), true);
  assert.equal(canReassign(user('ali'), seedLeads.find((lead) => lead.id === 'lead-samer')!, 'owais'), false);
});

test('three distinct incorrect reports create a review item', () => {
  const reports = seedLeads.find((lead) => lead.id === 'lead-samer')!.incorrectReports;
  assert.equal(incorrectReviewState(reports)?.state, 'pending');
});

test('terminal statuses cannot be reopened by a normal transition', () => {
  assert.equal(validStatusTransition('won', 'contacted'), false);
  assert.equal(validStatusTransition('connected', 'proposal_sent'), true);
});

test('duplicate candidates match exact normalized phone or email only', () => {
  const leads = structuredClone(seedLeads);
  leads.push({ ...structuredClone(leads[0]), id: 'lead-copy', name: 'Different Name', assignments: [], activities: [], followUps: [], incorrectReports: [] });
  assert.deepEqual(duplicateMatches(leads).find((match) => match.leadId === 'lead-ronald')?.matches, ['lead-copy']);
});

test('dashboard excludes other agents’ work', () => {
  const dashboard = dashboardFor(user('owais'), seedLeads);
  assert.equal(dashboard.visible.every((lead) => lead.assignments.some((assignment) => !assignment.endedAt && assignment.ownerId === 'owais')), true);
});

test('follow-up metrics distinguish a due-today task from an overdue task', () => {
  const dashboard = dashboardFor(user('mustabeen'), seedLeads);
  assert.equal(dashboard.dueToday, 0);
  assert.equal(dashboard.overdue, 1);
  const adminDashboard = dashboardFor(user('shariq'), seedLeads);
  assert.equal(adminDashboard.dueToday, 1);
  assert.equal(adminDashboard.overdue, 1);
});

test('source dictionary contains the approved dashboard source labels', () => {
  assert.deepEqual(sourceOptions, ['Bark Paid', 'Bark Stalk', 'Thumbtack', 'SEO', 'Social Media', 'Clutch', 'Email Marketing', 'LinkedIn', 'PPC', 'Other']);
});

test('lead categories match the approved workbook dropdown exactly', () => {
  assert.deepEqual(leadCategoryOptions.map((category) => leadCategoryLabels[category]), ['App', 'Game', 'SEO', 'SMM', 'Web', 'Not available']);
});

test('lead details are editable only by Admin and permitted Marketing roles', () => {
  const lead = seedLeads.find((candidate) => candidate.marketingOwnerId === 'hamza')!;
  const marketingManager = { id: 'shariq-marketing-manager', name: 'Shariq', role: 'manager' as const, department: 'marketing' as const };
  assert.equal(canEditLeadDetails(user('shariq'), lead), true);
  assert.equal(canEditLeadDetails(user('hamza'), lead), true);
  assert.equal(canEditLeadDetails(marketingManager, lead), true);
  assert.equal(canEditLeadDetails(user('ali'), lead), false);
  assert.equal(canEditLeadDetails(user('asad'), lead), false);
});

test('won financial values require non-negative total and upfront payment within total', () => {
  assert.equal(validWonFinancials(1000, 250), true);
  assert.equal(validWonFinancials(1000, 1200), false);
  assert.equal(validWonFinancials(-1, 0), false);
});

test('a stage transition closes the old stage and records the actor and exact transition time', () => {
  const initial = [{ id: 'stage-1', toStatus: 'contacted' as const, enteredAt: '2026-07-01T09:00:00.000Z', reason: 'Initial stage' }];
  const result = transitionStage(initial, 'connected', 'owais', '2026-07-01T10:30:00.000Z', 'Call completed');
  assert.equal(result[0].exitedAt, '2026-07-01T10:30:00.000Z');
  assert.deepEqual(result[1], { id: result[1].id, fromStatus: 'contacted', toStatus: 'connected', enteredAt: '2026-07-01T10:30:00.000Z', actorId: 'owais', reason: 'Call completed' });
});

test('stage ownership is split at reassignment so an agent is never judged for another owner’s time', () => {
  const stage = { id: 'stage-1', toStatus: 'connected' as const, enteredAt: '2026-07-01T09:00:00.000Z', exitedAt: '2026-07-01T12:00:00.000Z', reason: 'Status changed' };
  const assignments = [
    { id: 'as-1', ownerId: 'asad', assignedBy: 'ali', at: '2026-07-01T08:00:00.000Z', endedAt: '2026-07-01T10:00:00.000Z', visibility: 'full_context' as const, reason: 'Initial assignment' },
    { id: 'as-2', ownerId: 'owais', assignedBy: 'ali', at: '2026-07-01T10:00:00.000Z', visibility: 'full_context' as const, reason: 'Handoff' },
  ];
  assert.deepEqual(stageOwnershipSegments(stage, assignments, new Date('2026-07-01T13:00:00.000Z')), [
    { ownerId: 'asad', startedAt: '2026-07-01T09:00:00.000Z', endedAt: '2026-07-01T10:00:00.000Z' },
    { ownerId: 'owais', startedAt: '2026-07-01T10:00:00.000Z', endedAt: '2026-07-01T12:00:00.000Z' },
  ]);
});

test('dashboard filters use the selected date range, source, and status without including unmatched leads', () => {
  const range = dashboardDateRange('custom', new Date('2026-07-29T12:00:00.000Z'), { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T23:59:59.999Z' });
  const leads = [
    { ...structuredClone(seedLeads[0]), id: 'july-bark', source: 'Bark Paid', sourceDate: '2026-07-12' },
    { ...structuredClone(seedLeads[1]), id: 'july-seo', source: 'SEO', sourceDate: '2026-07-15' },
    { ...structuredClone(seedLeads[2]), id: 'june-bark', source: 'Bark Paid', sourceDate: '2026-06-30' },
  ];
  assert.deepEqual(filterDashboardLeads(leads, range, 'Bark Paid').map((lead) => lead.id), ['july-bark']);
  assert.deepEqual(filterDashboardLeads(leads, range, 'all', 'follow_up_required').map((lead) => lead.id), ['july-seo']);
});

test('benchmark metrics keep sources separate and exclude confirmed incorrect records from conversion', () => {
  const leads = structuredClone(seedLeads);
  leads.push({ ...structuredClone(leads[0]), id: 'lead-confirmed-incorrect', source: 'SEO', status: 'incorrect', incorrectReview: { state: 'confirmed_incorrect' }, assignments: [], activities: [], followUps: [], stageHistory: [] });
  const seo = benchmarkBySource(leads).find((item) => item.source === 'SEO')!;
  assert.equal(seo.sampleSize, 2);
  assert.equal(seo.sql, 2);
});

test('leaderboard returns sample size and does not expose contact fields', () => {
  const entry = leaderboardForSales(seedLeads).find((item) => item.userId === 'owais')!;
  assert.equal(entry.sampleSize, 2);
  assert.equal('email' in entry, false);
  assert.equal('phone' in entry, false);
});

test('data-quality exceptions flag missing Won financial values and reconciliation balances the source samples', () => {
  const broken = { ...structuredClone(seedLeads[0]), id: 'lead-broken-won', status: 'won' as const, totalProjectCost: undefined, upfrontPaymentAmount: undefined, followUps: [], activities: [], assignments: [] };
  assert.equal(dataQualityIssues([broken]).some((issue) => issue.type === 'won_financials'), true);
  const lifetime = dashboardDateRange('lifetime');
  assert.equal(dashboardReconciliation(seedLeads, lifetime).passes, true);
});

test('management performance boards and data-quality details are limited to the approved roles', () => {
  assert.equal(canViewManagementBoards(user('ali')), true);
  assert.equal(canViewManagementBoards(user('owais')), false);
  assert.equal(canViewDataQualityBoard(user('shariq')), true);
  assert.equal(canViewDataQualityBoard(user('muzammil')), false);
});

test('marketing leaderboard measures actionable yield, sales acceptance, and downstream conversion without contact fields', () => {
  const leads = structuredClone(seedLeads);
  leads.push({ ...structuredClone(leads[0]), id: 'marketing-yield', marketingOwnerId: 'muzammil', source: 'Bark Paid', status: 'won', qualification: 'sql', totalProjectCost: 2000, upfrontPaymentAmount: 500, wonAt: '2026-07-10T10:00:00.000Z', assignments: [{ id: 'assign-marketing-yield', ownerId: 'owais', assignedBy: 'muzammil', at: '2026-07-01T10:00:00.000Z', visibility: 'full_context', reason: 'Initial assignment' }], stageHistory: [{ id: 'stage-marketing-yield', toStatus: 'connected', enteredAt: '2026-07-02T10:00:00.000Z', reason: 'Contacted' }], activities: [], followUps: [], incorrectReports: [] });
  const entry = leaderboardForMarketing(leads).find((item) => item.userId === 'muzammil')!;
  assert.equal(entry.sampleSize > 0, true);
  assert.equal(entry.salesAcceptanceRate !== undefined, true);
  assert.equal(entry.actionableLeadYield !== undefined, true);
  assert.equal('email' in entry, false);
  assert.equal('phone' in entry, false);
});

test('dashboard completion metrics calculate response/routing time, loss reasons, and only recorded Won financials', () => {
  const lead = { ...structuredClone(seedLeads[0]), id: 'timed-lost', sourceDate: '2026-07-01T08:00:00.000Z', status: 'lost' as const, lostReason: 'Price or budget' as const, assignments: [{ id: 'timed-assignment', ownerId: 'owais', assignedBy: 'ali', at: '2026-07-01T09:00:00.000Z', visibility: 'full_context' as const, reason: 'Initial assignment' }], stageHistory: [{ id: 'timed-stage', toStatus: 'contacted' as const, enteredAt: '2026-07-01T11:30:00.000Z', reason: 'First call' }], totalProjectCost: undefined, upfrontPaymentAmount: undefined };
  assert.equal(responseHours(lead), 2.5);
  assert.equal(routingHours(lead), 1);
  assert.deepEqual(lossReasonBreakdown([lead]), [{ reason: 'Price or budget', count: 1 }]);
  assert.deepEqual(financialMetrics([lead]), { financialRecordCount: 0, totalProjectValue: 0, upfrontValue: 0, averageProjectValue: undefined });
});

test('named leaderboards stay manager/admin-only while individual users receive private standing', () => {
  assert.equal(canViewNamedLeaderboard(user('shariq')), true);
  assert.equal(canViewNamedLeaderboard(user('ali')), true);
  assert.equal(canViewNamedLeaderboard(user('owais')), false);
  assert.equal(canViewNamedLeaderboard(user('muzammil')), false);
});

test('lead identity requires a name plus at least one contact method', () => {
  assert.equal(isLeadIdentity('Jane', '+1 555 0100'), true);
  assert.equal(isLeadIdentity('Jane', undefined, 'jane@example.com'), true);
  assert.equal(isLeadIdentity('Jane'), false);
  assert.equal(isLeadIdentity('   ', '+1 555 0100'), false);
});

test('duplicate matching normalizes phone formatting but does not fuzzy-match values', () => {
  const leads = structuredClone(seedLeads);
  leads.push({ ...structuredClone(leads[0]), id: 'phone-format-copy', phone: '(1) 555-0101', email: undefined, assignments: [], activities: [], followUps: [], incorrectReports: [] });
  leads.push({ ...structuredClone(leads[0]), id: 'near-match', phone: '5550100001', email: undefined, assignments: [], activities: [], followUps: [], incorrectReports: [] });
  const match = duplicateMatches(leads).find((item) => item.leadId === 'lead-ronald');
  assert.equal(match?.matches.includes('phone-format-copy'), true);
  assert.equal(match?.matches.includes('near-match'), false);
});

test('incorrect threshold counts distinct reporters only', () => {
  const reports = [
    { reporterId: 'owais', reason: 'Invalid', at: '2026-07-01T09:00:00.000Z' },
    { reporterId: 'owais', reason: 'Duplicate', at: '2026-07-01T10:00:00.000Z' },
    { reporterId: 'asad', reason: 'Invalid', at: '2026-07-01T11:00:00.000Z' },
  ];
  assert.equal(incorrectReviewState(reports), undefined);
  assert.equal(incorrectReviewState([...reports, { reporterId: 'obaid', reason: 'Spam', at: '2026-07-01T12:00:00.000Z' }])?.state, 'pending');
});

test('non-Sales flags are evidence but do not increase the automatic threshold', () => {
  const reports = [
    { reporterId: 'owais', reporterRole: 'sales_agent' as const, reason: 'Invalid', at: '2026-07-01T09:00:00.000Z' },
    { reporterId: 'asad', reporterRole: 'sales_agent' as const, reason: 'Invalid', at: '2026-07-01T10:00:00.000Z' },
    { reporterId: 'hamza', reporterRole: 'marketer' as const, reason: 'Poor data', at: '2026-07-01T11:00:00.000Z' },
    { reporterId: 'shariq', reporterRole: 'admin' as const, reason: 'Review', at: '2026-07-01T12:00:00.000Z' },
  ];
  assert.equal(salesIncorrectReportCount(reports), 2);
  assert.equal(incorrectReviewState(reports), undefined);
  assert.equal(incorrectReviewState([...reports, { reporterId: 'obaid', reporterRole: 'sales_agent', reason: 'Invalid', at: '2026-07-01T13:00:00.000Z' }])?.state, 'pending');
});

test('authorized viewers may flag but Sales must be the current owner', () => {
  const lead = seedLeads.find((candidate) => candidate.marketingOwnerId === 'hamza' && candidate.assignments.length)!;
  assert.equal(canFlagIncorrectLead(user('shariq'), lead), true);
  assert.equal(canFlagIncorrectLead(user('hamza'), lead), true);
  assert.equal(canFlagIncorrectLead(user('owais'), lead), lead.assignments.some((assignment) => !assignment.endedAt && assignment.ownerId === 'owais'));
  assert.equal(canFlagIncorrectLead(user('mustabeen'), lead), lead.assignments.some((assignment) => !assignment.endedAt && assignment.ownerId === 'mustabeen'));
});

test('completed or cancelled follow-ups never remain due or overdue', () => {
  const now = new Date('2026-07-30T12:00:00.000Z');
  assert.equal(overdue({ id: 'open', ownerId: 'owais', dueAt: '2026-07-29T12:00:00.000Z', action: 'Call', status: 'open' }, now), true);
  assert.equal(overdue({ id: 'done', ownerId: 'owais', dueAt: '2026-07-29T12:00:00.000Z', action: 'Call', status: 'completed' }, now), false);
  assert.equal(dueToday({ id: 'cancelled', ownerId: 'owais', dueAt: '2026-07-30T12:00:00.000Z', action: 'Call', status: 'cancelled' }, now), false);
});

test('terminal statuses are all protected from reopening', () => {
  for (const terminal of ['won', 'lost', 'not_interested', 'incorrect', 'duplicate', 'do_not_contact'] as const) {
    assert.equal(validStatusTransition(terminal, 'connected'), false);
  }
});

test('marketer cannot update another marketer’s lead and sales agent cannot update an unassigned lead', () => {
  const marketingLead = seedLeads.find((lead) => lead.marketingOwnerId === 'muzammil')!;
  const unassigned = { ...structuredClone(seedLeads[0]), assignments: [] };
  assert.equal(canUpdateLead(user('yasir'), marketingLead), false);
  assert.equal(canUpdateLead(user('owais'), unassigned), false);
});

test('invalid assignment and stage date order are reported as data-quality issues', () => {
  const broken = {
    ...structuredClone(seedLeads[0]),
    id: 'broken-order',
    assignments: [{ id: 'bad-assignment', ownerId: 'owais', assignedBy: 'ali', at: '2026-07-10T10:00:00.000Z', endedAt: '2026-07-09T10:00:00.000Z', visibility: 'full_context' as const, reason: 'Bad data' }],
    stageHistory: [{ id: 'bad-stage', toStatus: 'contacted' as const, enteredAt: '2026-07-10T10:00:00.000Z', exitedAt: '2026-07-09T10:00:00.000Z', reason: 'Bad data' }],
  };
  const issues = dataQualityIssues([broken]);
  assert.equal(issues.filter((issue) => issue.type === 'date_order').length, 2);
});

test('empty qualified sample does not invent a conversion rate', () => {
  const leads = structuredClone(seedLeads).map((lead) => ({ ...lead, qualification: 'not_available' as const, status: 'assigned' as const }));
  assert.equal(dashboardFor(user('shariq'), leads).conversionRate, 0);
});
