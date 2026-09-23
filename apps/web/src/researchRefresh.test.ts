import test from 'node:test';
import assert from 'node:assert/strict';
import { researchRefresh } from './researchRefresh';

test('list loads immediately and each minute without overlapping requests', async () => {
  let tick = () => {}; let resolve!: (value: number) => void; let calls = 0; let cancelled = false;
  const values: number[] = [];
  const stop = researchRefresh({load: () => { calls++; return new Promise<number>(r => { resolve = r; }); },
    apply: v => values.push(v), fail: () => assert.fail(), settled: () => {},
    schedule: (fn, ms) => { assert.equal(ms, 60_000); tick = fn; return () => { cancelled = true; }; }});
  assert.equal(calls, 1); tick(); assert.equal(calls, 1);
  resolve(1); await Promise.resolve(); assert.deepEqual(values, [1]);
  tick(); assert.equal(calls, 2); stop(); resolve(2); await Promise.resolve();
  assert.deepEqual(values, [1]); tick(); assert.equal(calls, 2); assert.equal(cancelled, true);
});

test('failed refresh reports error, retries next minute and stops callbacks on disposal', async () => {
  let tick = () => {}; let calls = 0; let errors = 0; let settled = 0;
  const stop = researchRefresh({load: async () => { calls++; throw Error('offline'); },
    apply: () => assert.fail(), fail: () => { errors++; }, settled: () => { settled++; },
    schedule: fn => { tick = fn; return () => {}; }});
  await Promise.resolve(); assert.equal(errors, 1); assert.equal(settled, 1);
  tick(); stop(); await Promise.resolve(); assert.equal(calls, 2); assert.equal(errors, 1); assert.equal(settled, 1);
});
