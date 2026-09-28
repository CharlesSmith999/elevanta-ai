import test from 'node:test';
import assert from 'node:assert/strict';
import { newLead } from './app.js';

const base = { name: 'Synthetic prospect', source: 'Other', category: 'web' };
test('creation accepts phone-only, email-only and multiple contact methods', () => {
  for (const contactMethods of [[{ type: 'phone', value: '+1 555 123 4567' }], [{ type: 'email', value: 'test@example.com' }], [{ type: 'phone', value: '+1 555 123 4567' }, { type: 'phone', value: '+1 555 987 6543' }, { type: 'email', value: 'test@example.com' }]]) {
    assert.equal(newLead.safeParse({ ...base, contactMethods }).success, true);
  }
});
test('creation rejects masked, invalid and normalized duplicate contact values', () => {
  for (const contactMethods of [[{ type: 'phone', value: '555***1234' }], [{ type: 'email', value: 'test@' }], [{ type: 'phone', value: 'abc1234567' }], [{ type: 'email', value: 'test@example.com' }, { type: 'email', value: 'TEST@example.com' }], [{ type: 'phone', value: '+1 555 123 4567' }, { type: 'phone', value: '15551234567' }]]) {
    assert.equal(newLead.safeParse({ ...base, contactMethods }).success, false);
  }
});
test('creation retains legacy requests and rejects empty or excessive lists', () => {
  assert.equal(newLead.safeParse({ ...base, email: 'test@example.com' }).success, true);
  assert.equal(newLead.safeParse(base).success, false);
  assert.equal(newLead.safeParse({ ...base, contactMethods: [] }).success, false);
  assert.equal(newLead.safeParse({ ...base, contactMethods: Array.from({ length: 21 }, (_, i) => ({ type: 'email', value: `test${i}@example.com` })) }).success, false);
});
