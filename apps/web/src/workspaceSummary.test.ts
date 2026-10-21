import test from 'node:test';
import assert from 'node:assert/strict';
import { historicalStatusCounts, performanceRows, summaryNumber, summaryPercent, workloadBuckets, type WorkspaceSummary } from './workspaceSummary';
import type { User } from './domain';

const agent = (id: string, overrides: Partial<WorkspaceSummary['agentPerformance'][number]> = {}): WorkspaceSummary['agentPerformance'][number] => ({
  userId: id, name: id, role: 'sales_agent', currentAssigned: 0, worked: 0,
  connected: 0, proposal: 0, won: 0, lost: 0, mql: 0, sql: 0, revenue: 0,
  followUpCompletionRate: null, statuses: {}, ...overrides,
});
const summary = (rows: WorkspaceSummary['agentPerformance']): WorkspaceSummary => ({
  generatedAt: '2026-10-21T12:00:00Z', viewerId: 'admin',
  totals: {
    total: 10161, open: 100, assigned: 10161, unassigned: 0, mql: 9, sql: 15, won: 76, lost: 411,
    connected: 4, proposal: 5, overdue: 0, dueToday: 0, pendingReview: 0,
    totalProjectValue: 0, upfrontValue: 0, financialRecordCount: 0, followUpsOpen: 0,
    followUpsCompleted: 0, overdue1To3: 0, overdue3To7: 0, overdue7Plus: 0,
    medianResponseHours: null, medianRoutingHours: null, actionable: 0, cleanData: 0,
    missingContact: 0, duplicateCandidates: 0, incorrect: 0, needsInformation: 0, slowRouting: 0, meetingsBooked: null, meetingsHeld: null,
  },
  statusCounts: { connected: 1 }, qualificationCounts: {}, sourceCounts: [], categoryCounts: [], trend: [], lossReasons: [], agentPerformance: rows, recentWins: [], priorities: [],
});
const user = (id: string, role: User['role'] = 'sales_agent', department: User['department'] = 'sales'): User => ({ id, name: id, role, department });

test('historical Lost stays with the former owner while the current Connected status is separate', () => {
  const data = summary([
    agent('Mustabeen', { worked: 1, lost: 1, statuses: { lost: 1 } }),
    agent('Asad', { worked: 1, connected: 1, currentAssigned: 1, statuses: { connected: 1 } }),
  ]);
  assert.deepEqual(historicalStatusCounts(data, user('Mustabeen')), { lost: 1 });
  assert.deepEqual(historicalStatusCounts(data, user('Asad')), { connected: 1 });
  assert.deepEqual(data.statusCounts, { connected: 1 });
});

test('every supplied historical status is included, not only Won and Lost', () => {
  const statuses = { no_answer: 3, contacted: 8, connected: 6, follow_up_required: 4, qualified: 3, proposal_sent: 2, won: 1, lost: 2, incorrect: 1, not_available: 1 };
  assert.deepEqual(historicalStatusCounts(summary([agent('Asad', { statuses })]), user('Asad')), statuses);
});

test('sales totals do not double count marketer outcome attribution', () => {
  const data = summary([
    agent('Asad', { won: 1, statuses: { won: 1 } }),
    agent('Yasir', { role: 'marketer', won: 1, statuses: { won: 1 } }),
  ]);
  assert.deepEqual(historicalStatusCounts(data, user('admin', 'admin')), { won: 1 });
  assert.deepEqual(historicalStatusCounts(data, user('Shariq', 'manager', 'marketing')), { won: 1 });
});

test('personal dashboards cannot render peers from a management response', () => {
  const data = summary([agent('Asad'), agent('Owais'), agent('Yasir', { role: 'marketer' })]);
  assert.deepEqual(performanceRows(data, user('Asad')).map(row => row.userId), ['Asad']);
  assert.deepEqual(performanceRows(data, user('Yasir', 'marketer', 'marketing')).map(row => row.userId), ['Yasir']);
  assert.equal(performanceRows(data, user('admin', 'admin')).length, 3);
});

test('missing values and empty denominators are not rendered as zero performance', () => {
  assert.equal(summaryPercent(0, 0), 'Not available');
  assert.equal(summaryPercent(null, 10), 'Not available');
  assert.equal(summaryPercent(0, 10), '0%');
  assert.equal(summaryPercent(3, 4), '75%');
  assert.equal(summaryNumber(undefined), 'Not available');
  assert.equal(summaryNumber(0), '0');
});

test('workload only uses current sales assignments, not history or marketing attribution', () => {
  const data = summary([
    agent('Asad', { currentAssigned: 10, worked: 900 }),
    agent('Owais', { currentAssigned: 30, worked: 40 }),
    agent('Yasir', { role: 'marketer', currentAssigned: 1000 }),
  ]);
  assert.deepEqual(workloadBuckets(data).map(row => row.value), [1, 0, 1]);
});

test('complete aggregate counts are independent of the list page size', () => {
  const data = summary([]);
  assert.equal(data.totals.total, 10161);
  assert.equal(data.priorities.length, 0);
  assert.equal(data.recentWins.length, 0);
  assert.equal('leads' in data, false);
});
