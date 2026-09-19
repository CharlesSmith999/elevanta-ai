import assert from 'node:assert/strict';
import test from 'node:test';
import { canViewResearchLead, isReadyForSales, seedResearchLeads, validResearchMethod } from './inboundResearch.js';
import { users, type User } from './domain.js';

test('masked and malformed contact methods never satisfy Sales readiness', () => {
  assert.equal(validResearchMethod({ type: 'phone', value: '(555) ***-****' }), false);
  assert.equal(validResearchMethod({ type: 'email', value: 'a*****@example.com' }), false);
  assert.equal(validResearchMethod({ type: 'email', value: 'verified@example.com' }), true);
  assert.equal(validResearchMethod({ type: 'phone', value: '+1 (555) 123-4567' }), true);
  assert.equal(validResearchMethod({ type: 'phone', value: '123' }), false);
  assert.equal(isReadyForSales({ name: 'Lead', methods: [{ type: 'email', value: 'verified@example.com' }], duplicateState: 'clear' }), true);
  assert.equal(isReadyForSales({ name: '   ', methods: [{ type: 'email', value: 'verified@example.com' }], duplicateState: 'clear' }), false);
  assert.equal(isReadyForSales({ name: 'Lead', methods: [{ type: 'email', value: 'verified@example.com' }], duplicateState: 'confirmed' }), false);
});

test('research queue remains hidden from every Sales role', () => {
  const lead = seedResearchLeads[0];
  const marketingManager: User = { id: 'marketing-manager', name: 'Marketing Manager', role: 'manager', department: 'marketing' };
  const scopedUsers = users.map((user) => user.id === lead.marketingOwnerId ? { ...user, managerId: marketingManager.id } : user);
  assert.equal(canViewResearchLead(users.find((user) => user.id === 'mustabeen')!, lead, scopedUsers), false);
  assert.equal(canViewResearchLead(users.find((user) => user.id === 'ali')!, lead, scopedUsers), false);
  assert.equal(canViewResearchLead(users.find((user) => user.id === 'shariq')!, lead, scopedUsers), true);
  assert.equal(canViewResearchLead(marketingManager, lead, scopedUsers), true);
});
