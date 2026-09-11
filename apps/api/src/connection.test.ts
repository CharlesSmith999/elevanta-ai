import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from './app.js';
import { supabaseConfig, ConfigurationError } from './config.js';

const profile = { id: '00000000-0000-4000-8000-000000000001', workspace_id: '00000000-0000-4000-8000-000000000002', role: 'sales_agent', full_name: 'Synthetic Test Agent', manager_id: null, department: 'sales', active: true };

function fakeClient(mode: 'active' | 'invalid' | 'inactive' | 'error' = 'active') {
  const query = {
    select() { return query; }, eq() { return query; }, order() { return query; },
    maybeSingle: async () => ({ data: { ...profile, active: mode !== 'inactive' }, error: null }),
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [profile], error: null }).then(resolve); },
  };
  return {
    auth: { getUser: async () => {
      if (mode === 'error') throw new Error('Authentication temporarily unavailable.');
      return { data: { user: mode === 'invalid' ? null : { id: profile.id } }, error: null };
    } }, from: () => query,
  } as unknown as SupabaseClient;
}

for (const [mode, expected] of [['active', 200], ['invalid', 401], ['inactive', 403], ['error', 500]] as const) {
  test(`protected HTTP route completes for ${mode} user`, async () => {
    const server = createApp(() => fakeClient(mode)).listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const response = await fetch(`${base}/v1/me`, { headers: { Authorization: 'Bearer synthetic-test-token' }, signal: AbortSignal.timeout(2000) });
      assert.equal(response.status, expected);
      const body = await response.json();
      if (mode === 'active') {
        assert.equal(body.profile.id, profile.id);
        const directory = await fetch(`${base}/v1/workspace-members`, { headers: { Authorization: 'Bearer synthetic-test-token' }, signal: AbortSignal.timeout(2000) });
        assert.equal(directory.status, 200);
      } else assert.ok(body.message);
      const denied = await fetch(`${base}/v1/me`, { signal: AbortSignal.timeout(2000) });
      assert.equal(denied.status, 401);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
}

test('configuration validation rejects missing, malformed and non-HTTP URLs without exposing values', () => {
  for (const value of [undefined, '', 'not-a-url', 'file:///tmp/private', 'https://user:secret@example.com']) {
    assert.throws(() => supabaseConfig({ SUPABASE_URL: value, SUPABASE_ANON_KEY: 'private-test-key' }), (error: unknown) => error instanceof ConfigurationError && !error.message.includes('private-test-key') && !error.message.includes('secret'));
  }
  assert.throws(() => supabaseConfig({ SUPABASE_URL: 'https://example.supabase.co' }), ConfigurationError);
  assert.deepEqual(supabaseConfig({ SUPABASE_URL: ' https://example.supabase.co\n', SUPABASE_ANON_KEY: ' test-key\n' }), { url: 'https://example.supabase.co', anonKey: 'test-key' });
});
