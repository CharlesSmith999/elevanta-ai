import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { CallingRecord, CallingMethod, CallingEvent } from './callingList.js';

const outcomes = ['never','connected','no_answer','voicemail','busy','callback_requested','meeting_booked','not_interested','wrong_number','other'] as const;
export const callingPageSchema = z.object({
  viewerId: z.string().uuid().optional(),
  page: z.number().int().min(0).max(1_000_000).default(0),
  pageSize: z.union([z.literal(30), z.literal(50)]).default(30),
  tab: z.enum(['todo','called','followup']).default('todo'),
  outcomes: z.array(z.enum(outcomes)).max(outcomes.length).default([]),
  service: z.string().trim().max(100).default('all'),
  query: z.string().trim().max(200).default(''),
  reportDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
  }, 'Choose a valid report date.'),
  timeZone: z.string().max(100).refine(value => { try { new Intl.DateTimeFormat('en-US', {timeZone:value}).format(); return true; } catch { return false; } }, 'Choose a valid timezone.'),
});
export type CallingPageInput = z.infer<typeof callingPageSchema>;
export type CallingPageRow = { key: string; record: CallingRecord; method: CallingMethod; latest?: CallingEvent; calledToday: boolean; usable: boolean; due?: string };
export type CallingPage = { rows: CallingPageRow[]; total: number; page: number; pageSize: number; tabCounts: Record<'todo' | 'called' | 'followup', number>; metrics: { attempts: number; unique: number; connected: number; rate: number } };

// Always use the authenticated client. SQL validates self/admin preview and scopes every join.
export async function readCallingPage(client: SupabaseClient, input: CallingPageInput): Promise<CallingPage> {
  const { data, error } = await client.rpc('calling_page_v1', {
    p_viewer_id: input.viewerId ?? null, p_page: input.page, p_page_size: input.pageSize,
    p_tab: input.tab, p_outcomes: input.outcomes, p_service: input.service,
    p_query: input.query, p_report_day: input.reportDay, p_timezone: input.timeZone,
  });
  if (error) throw error;
  if (!data || !Array.isArray(data.rows)) throw new Error('Calling page returned an invalid response.');
  return data as CallingPage;
}

export async function readCallingExport(client: SupabaseClient, input: CallingPageInput): Promise<CallingRecord[]> {
  const records: CallingRecord[] = [];
  for (let page = 0; ; page++) {
    const result = await readCallingPage(client, {...input, page, pageSize:50});
    if (result.total > 20_000) throw new Error('Narrow the calling filters to 20,000 numbers or fewer before exporting.');
    records.push(...result.rows.filter(row => row.usable).map(row => row.record));
    if ((page + 1) * 50 >= result.total || !result.rows.length) break;
  }
  return records;
}
