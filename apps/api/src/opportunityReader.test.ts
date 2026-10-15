import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readOpportunities } from './opportunityReader.js';

type Row = Record<string, unknown>;

function fakeClient(fixtures: Record<string, Row[]>, calls: Array<{ table: string; columns: string; from: number; to: number; status?: string }>) {
  return {
    from(table: string) {
      let columns = '';
      let from = 0;
      let to = 499;
      let status: string | undefined;
      const query = {
        select(value: string) { columns = value; return query; },
        order() { return query; },
        range(start: number, end: number) { from = start; to = end; return query; },
        eq(field: string, value: string) { if (field === 'status') status = value; return query; },
        then(resolve: (value: { data: Row[]; error: null }) => unknown) {
          calls.push({ table, columns, from, to, status });
          const filtered = status ? (fixtures[table] ?? []).filter((row) => row.status === status) : (fixtures[table] ?? []);
          return Promise.resolve({ data: filtered.slice(from, to + 1), error: null }).then(resolve);
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
  const assignments = Array.from({ length: 501 }, (_, index) => ({ id: `assignment-${String(index).padStart(3, '0')}`, opportunity_id: 'lead-1' }));
  const fixtures: Record<string, Row[]> = {
    opportunities: [{ id: 'lead-1', status: 'won' }, { id: 'lead-2', status: 'lost' }],
    assignments,
    activities: [], follow_ups: [], incorrect_reports: [], incorrect_reviews: [],
  };

  const data = await readOpportunities(fakeClient(fixtures, calls), 'won');

  assert.deepEqual(data.map((row) => row.id), ['lead-1']);
  assert.equal((data[0].assignments as Row[]).length, 501);
  assert.equal(calls.filter((call) => call.table === 'assignments').length, 2);
  assert.equal(calls.find((call) => call.table === 'opportunities')?.status, 'won');
});
