import test from 'node:test';
import assert from 'node:assert/strict';
import { seedLeads, users } from './domain';
import { contactLinks, nextWorkbenchId, outreachAllowed, workbenchHistory, workbenchMethods } from './workbenchModel';
import type { LeadContactMethod } from './leadWorkflow';

const phone: LeadContactMethod = { id: 'method', type: 'phone', value: '+1 (202) 555-0101', focus: 'active', health: 'verified' };
test('outreach excludes removed, incorrect, wrong-person, global DNC, and paused leads', () => {
  const lead = { ...seedLeads[0], status: 'assigned' as const, routingPaused: false };
  assert.equal(outreachAllowed(lead, phone), true);
  for (const health of ['incorrect', 'wrong_person', 'do_not_contact'] as const) assert.equal(outreachAllowed(lead, { ...phone, health }), false);
  assert.equal(outreachAllowed(lead, { ...phone, focus: 'removed' }), false);
  assert.equal(outreachAllowed(lead, { ...phone, restricted: true }), false);
  assert.equal(outreachAllowed({ ...lead, routingPaused: true }, phone), false);
  assert.equal(outreachAllowed({ ...lead, status: 'do_not_contact' }, phone), false);
});
test('links never guess an international prefix and reject masked or injected numbers', () => {
  assert.deepEqual(contactLinks(phone), { call: 'tel:+12025550101', whatsapp: 'https://wa.me/12025550101' });
  assert.equal(contactLinks({ ...phone, value: '2025550101' }).whatsapp, undefined);
  for (const value of ['202***0101', 'javascript:123456789', '+123456789?body=test', '123']) assert.deepEqual(contactLinks({ ...phone, value }), {});
  assert.equal(contactLinks({ ...phone, type: 'email', value: 'demo@example.test' }).email, 'mailto:demo%40example.test');
  assert.deepEqual(contactLinks({ ...phone, type: 'email', value: 'a@example.test?bcc=someone@example.test' }), {});
});
test('remote contact shortcuts fail closed without health inventory and respect empty inventory', () => {
  const remote = { ...seedLeads[0], id: 'a99c0011-2222-4333-8444-555566667777', contactMethods: undefined };
  assert.deepEqual(workbenchMethods(remote), []);
  assert.deepEqual(workbenchMethods({ ...remote, contactMethods: [] }), []);
  assert.deepEqual(workbenchMethods({ ...remote, contactMethods: [phone] }), [phone]);
});
test('fresh-start workbench excludes earlier conversations even during Admin role preview', () => {
  const viewer = { ...users[0], id: 'agent', role: 'sales_agent' as const };
  const lead = { ...seedLeads[0], assignments: [{ id: 'assignment', ownerId: viewer.id, assignedBy: 'manager', at: '2026-10-10T00:00:00Z', visibility: 'fresh_start' as const, reason: 'Reassigned' }], activities: [
    { id: 'old', at: '2026-10-09T00:00:00Z', actorId: 'old-agent', kind: 'note' as const, body: 'Hidden old note' },
    { id: 'new', at: '2026-10-11T00:00:00Z', actorId: viewer.id, kind: 'note' as const, body: 'Current note' },
  ] };
  assert.deepEqual(workbenchHistory(lead, viewer).map(x => x.id), ['new']);
  assert.equal(workbenchHistory(lead, { ...viewer, role: 'admin' }).length, 2);
});
test('Save and Next has no wraparound and cannot advance from a filtered-out lead', () => {
  assert.equal(nextWorkbenchId(['a', 'b', 'c'], 'a'), 'b');
  assert.equal(nextWorkbenchId(['a', 'b', 'c'], 'c'), undefined);
  assert.equal(nextWorkbenchId(['a', 'b'], 'missing'), undefined);
});
