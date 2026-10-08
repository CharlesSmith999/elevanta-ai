import assert from 'node:assert/strict';
import test from 'node:test';
import { importChunks } from './importChunks';
test('Import batching preserves every row in order and caps row counts', () => {
  const rows = Array.from({length: 205}, (_, id) => ({id}));
  const chunks = [...importChunks({}, rows)];
  assert.deepEqual(chunks.map(c => c.length), [100,100,5]);
  assert.deepEqual(chunks.flat(), rows);
});
test('Import batching accounts for UTF-8 bytes and never truncates', () => {
  const rows = [{text:'字'.repeat(160000)}, {text:'字'.repeat(160000)}];
  assert.equal([...importChunks({},rows)].length,2);
  assert.throws(() => [...importChunks({},[{text:'字'.repeat(310000)}])], /not been truncated/);
  assert.deepEqual([...importChunks({},[])],[]);
});
