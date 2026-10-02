import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from './app.js';

const actor = '00000000-0000-4000-8000-000000000001';
const workspace = '00000000-0000-4000-8000-000000000002';
const target = '00000000-0000-4000-8000-000000000003';
const manager = '00000000-0000-4000-8000-000000000004';
const profile = (id: string, role = 'admin', department: string | null = null) => ({ id, workspace_id: workspace, role, department, manager_id: null as string | null, active: true, full_name: 'Test User' });

async function fixture(run: (f: { call: (method: string, body?: unknown, path?: string) => Promise<Response>; rows: Record<string, any[]>; state: { role: string; active: boolean; duplicate: boolean; created: number; failedInsert: boolean; removed: number } }) => Promise<void>) {
  const rows: Record<string, any[]> = { profiles: [profile(actor), profile(target, 'sales_agent', 'sales'), profile(manager, 'manager', 'sales')], assignments: [], audit_events: [] };
  rows.profiles[1].manager_id = manager;
  const state = { role: 'admin', active: true, duplicate: false, created: 0, failedInsert: false, removed: 0 };
  const admin = {
    auth: { admin: {
      createUser: async () => { state.created++; return { data: { user: state.duplicate ? null : { id: '00000000-0000-4000-8000-000000000005' } }, error: state.duplicate ? { message: 'Email already registered' } : null }; },
      deleteUser: async () => { state.removed++; return { error: null }; },
      getUserById: async () => ({ data: { user: { email: 'synthetic@example.invalid' } }, error: null }),
      listUsers: async () => ({ data: { users: [] }, error: null }),
    } },
    from(table: string) {
      const filters: Array<(row: any) => boolean> = []; let mode = ''; let payload: any; let head = false;
      const result = () => {
        const selected = (rows[table] ?? []).filter((row) => filters.every((filter) => filter(row)));
        if (mode === 'insert') {
          if (table === 'profiles' && state.failedInsert) return { data: null, error: { message: 'Profile insert failed' }, count: 0 };
          (rows[table] ??= []).push(payload); return { data: [payload], error: null, count: 1 };
        }
        if (mode === 'update') selected.forEach((row) => Object.assign(row, payload));
        return { data: head ? null : selected.map((row) => ({ ...row })), count: selected.length, error: null };
      };
      const q = {
        select(_fields?: string, options?: { head?: boolean }) { head = !!options?.head; return q; },
        eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return q; },
        is(key: string, value: unknown) { filters.push((row) => row[key] === value); return q; },
        order() { return q; }, insert(value: unknown) { mode = 'insert'; payload = value; return q; }, update(value: unknown) { mode = 'update'; payload = value; return q; },
        async maybeSingle() { const r = result(); return { ...r, data: r.data?.[0] ?? null }; },
        async single() { return q.maybeSingle(); },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) { return Promise.resolve(result()).then(resolve, reject); },
      }; return q;
    },
  } as unknown as SupabaseClient;
  const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { ...profile(actor), role: state.role, active: state.active }, error: null }) }) } as unknown as SupabaseClient;
  const server = createApp(() => client, () => admin).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const call = (method: string, body?: unknown, path = method === 'PATCH' ? `/v1/admin/users/${target}` : '/v1/admin/users') => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, { method, headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  try { await run({ call, rows, state }); } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}

test('Admin creates all five role configurations with audit and no password in profile', () => fixture(async ({ call, rows }) => {
  for (const [role, department] of [['admin', null], ['manager', 'sales'], ['manager', 'marketing'], ['sales_agent', 'sales'], ['marketer', 'marketing']]) {
    rows.profiles.find((row) => row.id === manager)!.department = department;
    const response = await call('POST', { email: 'Synthetic@example.invalid', password: 'Synthetic-test-only', fullName: 'Test User', role, department, managerId: role === 'sales_agent' || role === 'marketer' ? manager : null });
    assert.equal(response.status, 201, await response.text());
  }
  assert.equal(rows.audit_events.length, 5);
  assert.ok(rows.profiles.every((row) => !('password' in row)));
}));
test('Creation rejects incomplete, wrong-department, inactive and foreign managers', () => fixture(async ({ call, rows, state }) => {
  const body = { email: 'synthetic@example.invalid', password: 'Synthetic-test-only', fullName: 'Test User', role: 'sales_agent', department: 'sales', managerId: manager };
  assert.equal((await call('POST', { ...body, managerId: null })).status, 400);
  assert.equal((await call('POST', { ...body, department: 'marketing' })).status, 400);
  const item = rows.profiles.find((row) => row.id === manager)!;
  for (const changes of [{ department: null }, { department: 'marketing' }, { department: 'sales', active: false }, { active: true, workspace_id: target }]) {
    Object.assign(item, changes); assert.equal((await call('POST', body)).status, 422);
  }
  assert.equal(state.created, 0);
}));
test('Duplicate emails and failed profile creation never produce success', () => fixture(async ({ call, state }) => {
  const body = { email: 'synthetic@example.invalid', password: 'Synthetic-test-only', fullName: 'Test User', role: 'admin' };
  state.duplicate = true; assert.equal((await call('POST', body)).status, 422);
  state.duplicate = false; state.failedInsert = true; assert.equal((await call('POST', body)).status, 500); assert.equal(state.removed, 1);
}));
test('Only active Admin can access account management', () => fixture(async ({ call, state }) => {
  for (const role of ['manager', 'marketer', 'sales_agent']) {
    state.role = role;
    for (const method of ['GET', 'POST', 'PATCH']) assert.equal((await call(method, method === 'GET' ? undefined : {})).status, 403);
  }
  state.role = 'admin'; state.active = false; assert.equal((await call('GET')).status, 403);
}));
test('Edits preserve identity; inactive and reactivate use existing profile', () => fixture(async ({ call, rows }) => {
  assert.equal((await call('PATCH', { fullName: 'Updated User', active: false })).status, 200);
  assert.equal(rows.profiles[1].active, false); assert.equal(rows.profiles[1].full_name, 'Updated User');
  assert.equal((await call('PATCH', { active: true })).status, 200); assert.equal(rows.profiles.length, 3);
}));
test('Active assignments and reports block disabling; legacy manager department can be repaired', () => fixture(async ({ call, rows }) => {
  rows.assignments.push({ assigned_to: target, ended_at: null });
  assert.equal((await call('PATCH', { active: false })).status, 422);
  assert.equal((await call('PATCH', { role: 'admin' })).status, 422);
  assert.equal((await call('PATCH', { active: false }, `/v1/admin/users/${manager}`)).status, 422);
  rows.profiles[2].department = null; rows.profiles[1].department = null;
  assert.equal((await call('PATCH', { department: 'sales' }, `/v1/admin/users/${manager}`)).status, 200);
}));
test('Self access, foreign workspace and invalid role edits are denied', () => fixture(async ({ call, rows }) => {
  assert.equal((await call('PATCH', { active: false }, `/v1/admin/users/${actor}`)).status, 422);
  assert.equal((await call('PATCH', { role: 'manager', department: 'sales' }, `/v1/admin/users/${actor}`)).status, 422);
  assert.equal((await call('PATCH', { department: 'marketing' })).status, 422);
  rows.profiles[1].workspace_id = target; assert.equal((await call('PATCH', { fullName: 'Changed' })).status, 404);
}));
test('Legacy setup does not prevent name-only editing or safe deactivation', () => fixture(async ({ call, rows }) => {
  rows.profiles[1].department = null; rows.profiles[1].manager_id = actor;
  assert.equal((await call('PATCH', { fullName: 'Legacy User' })).status, 200);
  assert.equal((await call('PATCH', { active: false })).status, 200);
  assert.equal((await call('PATCH', { active: true })).status, 422);
}));
