import test from 'node:test';
import assert from 'node:assert/strict';
import { newestResearchFirst, isRecentResearchArrival } from './researchArrivals';

test('newest email is first, even when older emails were replayed later; input stays unchanged', () => {
  const rows = [{ id:'old',receivedAt:'2026-09-30T16:00Z' },{ id:'new',receivedAt:'2026-10-01T21:53:33Z' },{id:'middle',receivedAt:'2026-10-01T21:20Z'}];
  assert.deepEqual(newestResearchFirst(rows).map(row => row.id), ['new','middle','old']);
  assert.equal(rows[0].id, 'old');
});
test('ties are deterministic and invalid or missing dates go last', () => {
  const rows = [{id:'z',receivedAt:''},{id:'b',receivedAt:'2026-10-01T21:00Z'},{id:'a',receivedAt:'2026-10-01T21:00Z'},{id:'y',receivedAt:'not a date'}];
  assert.deepEqual(newestResearchFirst(rows).map(row => row.id), ['a','b','y','z']);
  assert.deepEqual(newestResearchFirst([]), []);
});
test('recent arrivals include exact 24-hour boundary, exclude older, future and invalid dates', () => {
  const now = Date.parse('2026-10-01T22:00Z');
  for (const receivedAt of ['2026-10-01T22:00Z','2026-09-30T22:00Z']) assert.equal(isRecentResearchArrival({receivedAt},now),true);
  for (const receivedAt of ['2026-09-30T21:59:59.999Z','2026-10-01T22:00:00.001Z','','bad']) assert.equal(isRecentResearchArrival({receivedAt},now),false);
});
