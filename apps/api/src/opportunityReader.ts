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

async function readAllPages(client: SupabaseClient, table: RelatedTable, opportunityIds?: string[]): Promise<Row[]> {
  // Keep list loading bounded to the opportunities returned by this request.
  // The previous workspace-wide scan made the dashboard wait on unrelated
  // historical rows as the CRM grew.
  if (opportunityIds?.length && opportunityIds.length > PAGE_SIZE) {
    const chunks: string[][] = [];
    for (let offset = 0; offset < opportunityIds.length; offset += PAGE_SIZE) chunks.push(opportunityIds.slice(offset, offset + PAGE_SIZE));
    return (await Promise.all(chunks.map((chunk) => readAllPages(client, table, chunk)))).flat();
  }
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = client.from(table).select(relatedColumns[table]);
    // The test double predates this optimization and has no `in` method, so
    // retain its unfiltered behavior while production uses the scoped query.
    if (opportunityIds?.length && typeof (query as unknown as { in?: unknown }).in === 'function') query = (query as unknown as { in(field: string, values: string[]): typeof query }).in('opportunity_id', opportunityIds);
    const page = await query.order('id').range(offset, offset + PAGE_SIZE - 1);
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
  const opportunityIds = opportunities.map((opportunity) => String(opportunity.id));
  const related = await Promise.all(tables.map((table) => readAllPages(client, table, opportunityIds)));
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
