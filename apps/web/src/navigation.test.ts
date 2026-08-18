import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationFor, canNavigateTo } from './navigation.js';
import { users, type User } from './domain.js';

const viewer = (id: string) => users.find((candidate) => candidate.id === id)!;
const marketingManager: User = { id: 'marketing-manager-test', name: 'Marketing Manager', role: 'manager', department: 'marketing' };

test('every role keeps Dashboard and Xaviar in its navigation contract', () => {
  for (const candidate of [viewer('shariq'), viewer('ali'), marketingManager, viewer('muzammil'), viewer('owais')]) {
    const pages = navigationFor(candidate).map((item) => item.page);
    assert.equal(pages[0], 'Dashboard');
    assert.equal(pages.includes('Xaviar'), true);
    assert.equal(new Set(pages).size, pages.length);
  }
});

test('admin-only navigation never leaks into agent roles', () => {
  for (const candidate of [viewer('muzammil'), viewer('owais')]) {
    assert.equal(canNavigateTo(candidate, 'User management'), false);
    assert.equal(canNavigateTo(candidate, 'Review queue'), false);
    assert.equal(canNavigateTo(candidate, 'Data quality'), false);
  }
  assert.equal(canNavigateTo(viewer('shariq'), 'User management'), true);
  assert.equal(canNavigateTo(viewer('shariq'), 'Review queue'), true);
});

test('manager navigation follows the approved department workflow', () => {
  assert.equal(canNavigateTo(marketingManager, 'Follow-ups'), false);
  assert.equal(canNavigateTo(marketingManager, 'Assignments'), true);
  assert.equal(canNavigateTo(viewer('ali'), 'Follow-ups'), true);
  assert.equal(canNavigateTo(viewer('ali'), 'Assignments'), true);
});
