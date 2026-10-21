import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedRead, loadAllPages } from './pagedLoader';

test('client consumes every bounded page before resolving and reports real progress', async () => {
  const records = Array.from({ length: 10_161 }, (_, index) => ({ id: String(index), history: ['preserved'] }));
  const progress: number[] = [];
  const result = await loadAllPages(async (after) => {
    const offset = after ? Number(after) + 1 : 0;
    const rows = records.slice(offset, offset + 100);
    return { rows, nextCursor: rows.length === 100 ? rows.at(-1)!.id : null };
  }, { onProgress: (count) => progress.push(count) });
  assert.deepEqual(result, records);
  assert.equal(progress.length, 102);
  assert.equal(progress.at(-1), 10_161);
});

test('exact page multiples and empty collections terminate without losing records', async () => {
  let calls = 0;
  const result = await loadAllPages(async (after) => { calls++; return after ? { rows: [], nextCursor: null } : { rows: [{ id: 'last' }], nextCursor: 'last' }; });
  assert.equal(result.length, 1);
  assert.equal(calls, 2);
  assert.deepEqual(await loadAllPages(async () => ({ rows: [], nextCursor: null })), []);
});

test('500-record pages preserve exact multiples and a partial final page', async () => {
  for (const count of [0, 500, 1000, 10_327]) {
    const records = Array.from({ length: count }, (_, index) => ({ id: String(index) }));
    let calls = 0;
    const result = await loadAllPages(async (after) => {
      calls++;
      const offset = after ? Number(after) + 1 : 0;
      const rows = records.slice(offset, offset + 500);
      return { rows, nextCursor: rows.length === 500 ? rows.at(-1)!.id : null };
    });
    assert.deepEqual(result, records);
    assert.equal(calls, Math.floor(count / 500) + 1);
  }
});

test('failed later page rejects rather than returning misleading partial totals', async () => {
  await assert.rejects(loadAllPages(async (after) => {
    if (after) throw new Error('Synthetic API failure');
    return { rows: [{ id: 'first' }], nextCursor: 'first' };
  }), /Synthetic API failure/);
});

test('repeated or missing cursors fail instead of looping or silently truncating', async () => {
  await assert.rejects(loadAllPages(async () => ({ rows: [{ id: 'first' }], nextCursor: 'first' })), /did not advance/);
  await assert.rejects(loadAllPages(async () => ({ rows: [{ id: 'first' }], nextCursor: undefined as unknown as string })), /did not advance/);
});

test('hanging reads time out and abort the underlying request', async () => {
  let requestSignal: AbortSignal | undefined;
  await assert.rejects(boundedRead((signal) => { requestSignal = signal; return new Promise(() => {}); }, undefined, 10), /timed out/);
  assert.equal(requestSignal?.aborted, true);
});

test('cancellation stops a pending read and pre-cancelled loads make no request', async () => {
  const controller = new AbortController();
  const pending = boundedRead(() => new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  let called = false;
  await assert.rejects(loadAllPages(async () => { called = true; return { rows: [], nextCursor: null }; }, { signal: controller.signal }), /cancelled/);
  assert.equal(called, false);
});
