import test from 'node:test';
import assert from 'node:assert/strict';
import { shortcutHref } from './shortcutLinks';
import type { LeadContactMethod } from './leadWorkflow';
const phone: LeadContactMethod = { id: 'sample', type: 'phone', value: '+1 (202) 555-0100', health: 'verified', focus: 'active' };
test('shortcuts open dialer and email without inventing a country code', () => {
  assert.equal(shortcutHref(phone), 'tel:+12025550100');
  assert.equal(shortcutHref({ ...phone, value: '2025550100' }), 'tel:2025550100');
  assert.equal(shortcutHref({ ...phone, type: 'email', value: 'demo@example.test' }), 'mailto:demo%40example.test');
});
test('shortcuts reject restricted contacts and malformed destinations', () => {
  for (const health of ['incorrect', 'wrong_person', 'do_not_contact'] as const) assert.equal(shortcutHref({ ...phone, health }), undefined);
  assert.equal(shortcutHref({ ...phone, restricted: true }), undefined);
  assert.equal(shortcutHref({ ...phone, focus: 'removed' }), undefined);
  for (const value of ['123', '202***0100', 'javascript:123456789', '+123456789?body=text']) assert.equal(shortcutHref({ ...phone, value }), undefined);
  assert.equal(shortcutHref({ ...phone, type: 'email', value: 'a@example.test?bcc=x@example.test' }), undefined);
});
