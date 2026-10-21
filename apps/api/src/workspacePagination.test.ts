import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import { createApp } from './app.js';

const uuid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const profile = { id: uuid(999_999), workspace_id: uuid(999_998), role: 'admin', active: true };
type Row = Record<string, unknown>;

test('authenticated CRM, research and history handlers expose complete bounded cursor pages', async () => {
  const records = Array.from({ length: 501 }, (_, index) => ({ id: uuid(index), status: 'won' }));
  const fixtures: Record<string, Row[]> = { opportunities: records, inbound_lead_candidates: records, activities: records.map((row) => ({ ...row, opportunity_id: uuid(0) })) };
  const queries: Array<{ table: string; after?: string; length: number }> = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: profile.id } }, error: null }) },
    from(table: string) {
      let start = 0; let end = 999; let after: string | undefined;
      let selectedIds: string[] | undefined;
      const filters: Array<[string, unknown]> = [];
      const query = {
        select() { return query; }, order() { return query; },
        eq(field: string, value: unknown) { filters.push([field, value]); return query; },
        gt(_field: string, value: string) { after = value; return query; },
        in(_field: string, values: string[]) { selectedIds = values; assert.ok(values.length <= 100); return query; },
        range(from: number, to: number) { start = from; end = to; return query; },
        maybeSingle: async () => ({ data: profile, error: null }),
        then(resolve: (result: unknown) => unknown) {
          const data = (fixtures[table] ?? []).filter((row) => (!after || String(row.id) > after) && (!selectedIds || selectedIds.includes(String(row.opportunity_id))) && filters.every(([field, value]) => row[field] === value)).slice(start, end + 1);
          queries.push({ table, after, length: data.length });
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  const app = createApp(() => client);
  // Invoke the real registered authentication and route handlers without a
  // listening socket, so these tests also run in restricted build environments.
  const get = (path: string, query: Record<string, string>) => new Promise<Record<string, any>>((resolve, reject) => {
    const layer = app.router.stack.find((item: any) => item.route?.path === path);
    const handlers = layer?.route?.stack;
    assert.ok(handlers, `Missing route ${path}`);
    const request = { header: () => 'Bearer synthetic', query, params: { id: uuid(0) } } as unknown as Request;
    const response = { locals: {}, status() { return response; }, json: resolve } as unknown as Response;
    let index = 0;
    const next = (error?: unknown) => {
      if (error) { reject(error); return; }
      const handler = handlers[index++];
      if (!handler) { reject(new Error('Route did not respond')); return; }
      handler.handle(request, response, next);
    };
    next();
  });
    for (const [route, key] of [['/v1/opportunities', 'opportunities'], ['/v1/inbound/research-leads', 'researchLeads'], ['/v1/opportunities/:id/activity-history', 'activities']]) {
      const pageSize = key === 'opportunities' ? 500 : 250;
      const loaded: Row[] = [];
      let after: string | null = null;
      let pages = 0;
      do {
        const params: Record<string, string> = { limit: String(pageSize) };
        if (after) params.after = after;
        const body = await get(route, params);
        assert.ok(body[key].length <= pageSize);
        loaded.push(...body[key]);
        after = body.nextCursor;
        assert.ok(++pages <= 3);
      } while (after);
      assert.equal(loaded.length, 501, route);
      assert.equal(new Set(loaded.map((row) => row.id)).size, 501, route);
      assert.equal(pages, key === 'opportunities' ? 2 : 3, route);
      await assert.rejects(get(route, { after: 'invalid' }));
    }
    assert.ok(queries.some((query) => query.after === uuid(249)));
});
