import assert from 'node:assert/strict';
import test from 'node:test';
import { canReassign, canViewLead, dashboardFor, duplicateMatches, incorrectReviewState, seedLeads, users, validStatusTransition } from './domain.js';

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
