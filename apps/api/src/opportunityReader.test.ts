import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readOpportunities } from './opportunityReader.js';

type Row = Record<string, unknown>;

type Call = { table: string; columns: string; from: number; to: number; status?: string; ids?: string[]; after?: string };
function fakeClient(fixtures: Record<string, Row[]>, calls: Call[], failingTable?: string) {
  return {
    from(table: string) {
      let columns = '';
      let from = 0;
      let to = 499;
      let status: string | undefined;
      let ids: string[] | undefined;
      let after: string | undefined;
      const query = {
        select(value: string) { columns = value; return query; },
        order() { return query; },
        range(start: number, end: number) { from = start; to = end; return query; },
        eq(field: string, value: string) { if (field === 'status') status = value; return query; },
        in(field: string, value: string[]) { assert.equal(field, 'opportunity_id'); ids = value; return query; },
        gt(field: string, value: string) { assert.equal(field, 'id'); after = value; return query; },
        then(resolve: (value: { data: Row[]; error: Error | null }) => unknown) {
          calls.push({ table, columns, from, to, status, ids, after });
          const filtered = (fixtures[table] ?? []).filter((row) => (!status || row.status === status) && (!ids || ids.includes(String(row.opportunity_id))) && (!after || String(row.id) > after));
          return Promise.resolve({ data: filtered.slice(from, to + 1), error: table === failingTable ? new Error('Synthetic database failure') : null }).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

test('opportunity reader avoids the relationship cross product and preserves related CRM data', async () => {
  const calls: Array<{ table: string; columns: string; from: number; to: number; status?: string }> = [];
  const fixtures: Record<string, Row[]> = {
    opportunities: [
      { id: 'lead-1', status: 'won', contacts: { name: 'First' } },
      { id: 'lead-2', status: 'lost', contacts: { name: 'Second' } },
    ],
    assignments: [{ id: 'assignment-1', opportunity_id: 'lead-1', assigned_to: 'agent-1' }],
    activities: [{ id: 'activity-1', opportunity_id: 'lead-1', type: 'status_change' }],
    follow_ups: [{ id: 'follow-up-1', opportunity_id: 'lead-2', status: 'open' }],
    incorrect_reports: [{ id: 'report-1', opportunity_id: 'lead-2', reason_code: 'Invalid contact information' }],
    incorrect_reviews: [{ id: 'review-1', opportunity_id: 'lead-2', decision: null }],
  };

  const data = await readOpportunities(fakeClient(fixtures, calls));

  assert.equal(data.length, 2);
  assert.equal((data[0].assignments as Row[])[0].id, 'assignment-1');
  assert.equal((data[0].activities as Row[])[0].id, 'activity-1');
  assert.equal((data[1].follow_ups as Row[])[0].id, 'follow-up-1');
  assert.equal((data[1].incorrect_reports as Row[])[0].id, 'report-1');
  assert.equal((data[1].incorrect_reviews as Row[])[0].id, 'review-1');
  assert.equal(calls.find((call) => call.table === 'opportunities')?.columns, '*,contacts(*)');
  assert.ok(calls.every((call) => !call.columns.includes('assignments(') && !call.columns.includes('activities(')));
});

test('opportunity reader pages large relations and keeps the status filter', async () => {
  const calls: Array<{ table: string; columns: string; from: number; to: number; status?: string }> = [];
  const assignments = Array.from({ length: 1001 }, (_, index) => ({ id: `assignment-${String(index).padStart(4, '0')}`, opportunity_id: 'lead-1' }));
  const fixtures: Record<string, Row[]> = {
    opportunities: [{ id: 'lead-1', status: 'won' }, { id: 'lead-2', status: 'lost' }],
    assignments,
    activities: [], follow_ups: [], incorrect_reports: [], incorrect_reviews: [],
  };

  const data = await readOpportunities(fakeClient(fixtures, calls), 'won');

  assert.deepEqual(data.map((row) => row.id), ['lead-1']);
  assert.equal((data[0].assignments as Row[]).length, 1001);
  assert.equal(calls.filter((call) => call.table === 'assignments').length, 2);
  assert.equal(calls.find((call) => call.table === 'opportunities')?.status, 'won');
});

test('bounded opportunity pages retain all 10,161 records and scope every relation', async () => {
  const calls: Call[] = [];
  const opportunities = Array.from({ length: 10_161 }, (_, index) => ({ id: `lead-${String(index).padStart(5, '0')}`, status: 'won' }));
  const fixtures = { opportunities, activities: opportunities.map((row) => ({ id: `activity-${row.id}`, opportunity_id: row.id })) };
  const client = fakeClient(fixtures, calls);
  const loaded: Row[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await readOpportunities(client, undefined, { after, limit: 250 });
    loaded.push(...page);
    if (page.length < 250) break;
    after = String(page.at(-1)!.id);
  }
  assert.equal(loaded.length, 10_161);
  assert.equal(new Set(loaded.map((row) => row.id)).size, 10_161);
  assert.ok(loaded.every((row) => (row.activities as Row[]).length === 1));
  assert.ok(calls.filter((call) => call.table !== 'opportunities').every((call) => call.ids && call.ids.length <= 100));
  assert.ok(calls.filter((call) => call.table === 'opportunities').every((call) => call.to - call.from < 250));
});

test('empty page does not scan any history and relationship errors are not hidden', async () => {
  const calls: Call[] = [];
  assert.deepEqual(await readOpportunities(fakeClient({}, calls)), []);
  assert.equal(calls.length, 1);
  await assert.rejects(readOpportunities(fakeClient({ opportunities: [{ id: 'lead-1' }] }, [], 'activities')), /Synthetic database failure/);
});

test('page size is capped and unrelated relationship rows are never returned', async () => {
  const calls: Call[] = [];
  const data = await readOpportunities(fakeClient({ opportunities: [{ id: 'lead-1' }], activities: [{ id: 'other', opportunity_id: 'lead-elsewhere' }] }, calls), undefined, { limit: 500 });
  assert.equal(calls[0].to, 249);
  assert.deepEqual(data[0].activities, []);
});
