import assert from 'node:assert/strict';
import test from 'node:test';
import { canRestore, focusForHealth, isCallable, type LeadContactMethod } from './leadWorkflow';

const phone = (overrides: Partial<LeadContactMethod> = {}): LeadContactMethod => ({ id: 'phone-1', type: 'phone', value: '+1 555 100 2000', health: 'unverified', focus: 'active', ...overrides });

test('incorrect and wrong-person contact methods leave active focus', () => {
  assert.equal(focusForHealth('incorrect'), 'removed');
  assert.equal(focusForHealth('wrong_person'), 'removed');
  assert.equal(focusForHealth('do_not_contact'), 'removed');
});

test('reception stays visible as a secondary contact method', () => {
  assert.equal(focusForHealth('reception_gatekeeper'), 'secondary');
  assert.equal(isCallable(phone({ focus: 'secondary', health: 'reception_gatekeeper' })), true);
});

test('Sales cannot restore removed contact methods', () => {
  assert.equal(canRestore(phone({ focus: 'removed', health: 'incorrect' }), 'sales_agent'), false);
  assert.equal(canRestore(phone({ focus: 'removed', health: 'incorrect' }), 'marketer'), true);
});

test('Do Not Contact restoration is limited to Manager or Admin', () => {
  const restricted = phone({ focus: 'removed', health: 'do_not_contact', restricted: true });
  assert.equal(canRestore(restricted, 'marketer'), false);
  assert.equal(canRestore(restricted, 'manager'), true);
  assert.equal(canRestore(restricted, 'admin'), true);
  assert.equal(isCallable(restricted), false);
});
