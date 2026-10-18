import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type RelatedTable = 'assignments' | 'activities' | 'follow_ups' | 'incorrect_reports' | 'incorrect_reviews';

const PAGE_SIZE = 1000;

const relatedColumns: Record<RelatedTable, string> = {
  assignments: 'id,opportunity_id,assigned_to,assigned_by,visibility_mode,reason,started_at,ended_at',
  activities: 'id,opportunity_id,actor_id,type,body,from_status,to_status,created_at',
  follow_ups: 'id,opportunity_id,owner_id,due_at,action_type,status,completed_at',
  incorrect_reports: 'id,opportunity_id,reporter_id,reporter_role,reason_code,evidence,created_at',
  incorrect_reviews: 'id,opportunity_id,decision,reviewer_id,decision_reason,decided_at',
};

async function readAllPages(client: SupabaseClient, table: RelatedTable): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await client.from(table).select(relatedColumns[table]).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (page.error) throw page.error;
    rows.push(...((page.data ?? []) as unknown as Row[]));
    if ((page.data ?? []).length < PAGE_SIZE) return rows;
  }
}

function groupByOpportunity(rows: Row[]) {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const opportunityId = String(row.opportunity_id ?? '');
    if (!opportunityId) continue;
    const current = grouped.get(opportunityId);
    if (current) current.push(row);
    else grouped.set(opportunityId, [row]);
  }
  return grouped;
}

export async function readOpportunities(client: SupabaseClient, status?: string): Promise<Row[]> {
  const opportunities: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from('opportunities').select('*,contacts(*)').order('updated_at', { ascending: false }).order('id').range(offset, offset + PAGE_SIZE - 1);
    if (status) query = query.eq('status', status);
    const page = await query;
    if (page.error) throw page.error;
    opportunities.push(...((page.data ?? []) as unknown as Row[]));
    if ((page.data ?? []).length < PAGE_SIZE) break;
  }

  if (!opportunities.length) return opportunities;

  // Read each one-to-many relationship separately. Embedding all of them in
  // one PostgREST query creates a Cartesian product and times out as history grows.
  const tables: RelatedTable[] = ['assignments', 'activities', 'follow_ups', 'incorrect_reports', 'incorrect_reviews'];
  const related = await Promise.all(tables.map((table) => readAllPages(client, table)));
  const grouped = new Map(tables.map((table, index) => [table, groupByOpportunity(related[index])])) as Map<RelatedTable, Map<string, Row[]>>;

  return opportunities.map((opportunity): Row => {
    const opportunityId = String(opportunity.id);
    return {
      ...opportunity,
      assignments: grouped.get('assignments')?.get(opportunityId) ?? [],
      activities: grouped.get('activities')?.get(opportunityId) ?? [],
      follow_ups: grouped.get('follow_ups')?.get(opportunityId) ?? [],
      incorrect_reports: grouped.get('incorrect_reports')?.get(opportunityId) ?? [],
      incorrect_reviews: grouped.get('incorrect_reviews')?.get(opportunityId) ?? [],
    };
  });
}

export async function readOpportunityPage(client: SupabaseClient, options: { status?: string; offset: number; limit: number }): Promise<{ opportunities: Row[]; hasMore: boolean }> {
  let query = client.from('opportunities').select('*,contacts(*)').order('updated_at', { ascending: false }).order('id').range(options.offset, options.offset + options.limit - 1);
  if (options.status) query = query.eq('status', options.status);
  const page = await query;
  if (page.error) throw page.error;
  const opportunities = (page.data ?? []) as unknown as Row[];
  if (!opportunities.length) return { opportunities: [], hasMore: false };
  const ids = opportunities.map((item) => String(item.id));
  const tables: RelatedTable[] = ['assignments', 'activities', 'follow_ups', 'incorrect_reports', 'incorrect_reviews'];
  const related = await Promise.all(tables.map(async (table) => {
    const result = await client.from(table).select(relatedColumns[table]).in('opportunity_id', ids).order('id');
    if (result.error) throw result.error;
    return result.data ?? [];
  }));
  const grouped = new Map(tables.map((table, index) => [table, groupByOpportunity(related[index] as unknown as Row[])])) as Map<RelatedTable, Map<string, Row[]>>;
  return {
    opportunities: opportunities.map((opportunity): Row => {
      const opportunityId = String(opportunity.id);
      return { ...opportunity, assignments: grouped.get('assignments')?.get(opportunityId) ?? [], activities: grouped.get('activities')?.get(opportunityId) ?? [], follow_ups: grouped.get('follow_ups')?.get(opportunityId) ?? [], incorrect_reports: grouped.get('incorrect_reports')?.get(opportunityId) ?? [], incorrect_reviews: grouped.get('incorrect_reviews')?.get(opportunityId) ?? [] };
    }),
    hasMore: opportunities.length === options.limit,
  };
}
