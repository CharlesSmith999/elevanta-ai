import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkBySource, canReassign, canViewDataQualityBoard, canViewLead, canViewManagementBoards, dashboardDateRange, dashboardFor, dashboardReconciliation, dataQualityIssues, duplicateMatches, filterDashboardLeads, incorrectReviewState, leaderboardForSales, seedLeads, sourceOptions, stageOwnershipSegments, transitionStage, users, validStatusTransition, validWonFinancials } from './domain.js';

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

test('dashboard filters use the selected date range and source without including unmatched leads', () => {
  const range = dashboardDateRange('custom', new Date('2026-07-29T12:00:00.000Z'), { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T23:59:59.999Z' });
  const leads = [
    { ...structuredClone(seedLeads[0]), id: 'july-bark', source: 'Bark Paid', sourceDate: '2026-07-12' },
    { ...structuredClone(seedLeads[1]), id: 'july-seo', source: 'SEO', sourceDate: '2026-07-15' },
    { ...structuredClone(seedLeads[2]), id: 'june-bark', source: 'Bark Paid', sourceDate: '2026-06-30' },
  ];
  assert.deepEqual(filterDashboardLeads(leads, range, 'Bark Paid').map((lead) => lead.id), ['july-bark']);
});

test('benchmark metrics keep sources separate and exclude confirmed incorrect records from conversion', () => {
  const leads = structuredClone(seedLeads);
  leads.push({ ...structuredClone(leads[0]), id: 'lead-confirmed-incorrect', source: 'SEO', status: 'incorrect', incorrectReview: { state: 'confirmed_incorrect' }, assignments: [], activities: [], followUps: [], stageHistory: [] });
  const seo = benchmarkBySource(leads).find((item) => item.source === 'SEO')!;
  assert.equal(seo.sampleSize, 1);
  assert.equal(seo.sql, 1);
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
