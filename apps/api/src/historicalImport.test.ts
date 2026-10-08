import test from 'node:test';
import assert from 'node:assert/strict';
import { stageImportRequest, importPageQuery, historicalActivationRequest } from './historicalImport.js';
import { createApp } from './app.js';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';

const row = { recordId: 'R000001', groupId: 'G000001', disposition: 'ready', sourceSheet: 'Synthetic', sourceRow: 2, name: 'Synthetic person', phones: ['2025550100'], emails: [], values: { Status: 'Not available', 'Source Date': '2025-08-01', 'Won value': null }, sourceLinks: [{ 'Source Sheet': 'Synthetic', 'Source Row': 2, Details: 'Original note' }] };
const manifest = { format: 'elevanta-history-v1', sourceSha256: 'a'.repeat(64), workbookName: 'synthetic.xlsx', expectedRows: 2 };
test('preserves missing values and source history without manufacturing status or revenue', () => {
  const result = stageImportRequest.parse({ manifest, rows: [row] });
  assert.deepEqual(result.rows[0].values, row.values);
  assert.deepEqual(result.rows[0].sourceLinks, row.sourceLinks);
});
test('name plus either contact method is required', () => {
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, name: '' }] }).success, false);
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, phones: [], emails: [] }] }).success, false);
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, phones: [], emails: ['synthetic@example.invalid'] }] }).success, true);
});
test('rejects repeated row IDs, malformed methods, and chunks over the declared count', () => {
  for (const rows of [[row, row], [{ ...row, phones: ['123'] }], [{ ...row, emails: ['masked***'] }]]) {
    assert.equal(stageImportRequest.safeParse({ manifest, rows }).success, false);
  }
  assert.equal(stageImportRequest.safeParse({ manifest: { ...manifest, expectedRows: 1 }, rows: [row, { ...row, recordId: 'R000002' }] }).success, false);
});
test('requires source links, provenance, and a stable source hash', () => {
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, sourceLinks: [] }] }).success, false);
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, sourceRow: 0 }] }).success, false);
  assert.equal(stageImportRequest.safeParse({ manifest: { ...manifest, sourceSha256: 'bad' }, rows: [row] }).success, false);
});
test('rejects hidden activation fields and unbounded review pagination', () => {
  assert.equal(stageImportRequest.safeParse({ manifest, rows: [{ ...row, activate: true }] }).success, false);
  assert.equal(importPageQuery.safeParse({ offset: -1 }).success, false);
  assert.equal(importPageQuery.safeParse({ offset: 100001 }).success, false);
  assert.deepEqual(importPageQuery.parse({}), { offset: 0 });
  assert.deepEqual(historicalActivationRequest.parse({ batchId: '00000000-0000-4000-8000-000000000001' }), { batchId: '00000000-0000-4000-8000-000000000001', limit: 100 });
  assert.equal(historicalActivationRequest.safeParse({ batchId: '00000000-0000-4000-8000-000000000001', limit: 101 }).success, false);
  assert.equal(historicalActivationRequest.safeParse({ batchId: '00000000-0000-4000-8000-000000000001', limit: 0 }).success, false);
});

test('import routes deny every non-Admin role before database access', async () => {
  for (const role of ['sales_agent', 'marketer', 'manager']) {
    const profile = { id: '00000000-0000-4000-8000-000000000011', workspace_id: '00000000-0000-4000-8000-000000000001', role, department: 'sales', active: true };
    const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => ({ data: profile, error: null }) };
    const client = { auth: { getUser: async () => ({ data: { user: { id: profile.id } }, error: null }) }, from: (name: string) => { assert.equal(name, 'profiles'); return q; }, rpc() { assert.fail('Non-Admin reached an import RPC'); } } as unknown as SupabaseClient;
    const server = createApp(() => client).listen(0, '127.0.0.1');
    try {
      await new Promise<void>(resolve => server.once('listening', resolve));
      for (const [path, method] of [['/v1/imports','GET'], ['/v1/imports/stage','POST'], ['/v1/imports/validate','POST'], ['/v1/imports/commit','POST'], [`/v1/imports/${profile.id}/rows`,'GET']]) {
        const result = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, { method, headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
        assert.equal(result.status, 403, `${role} ${path}`);
      }
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});
