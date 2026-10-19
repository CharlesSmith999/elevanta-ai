import type { SupabaseClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
type RelatedTable = 'assignments' | 'activities' | 'follow_ups' | 'incorrect_reports' | 'incorrect_reviews';

const PAGE_SIZE = 1000;
const RELATED_ID_BATCH_SIZE = 100;

const relatedColumns: Record<RelatedTable, string> = {
  assignments: 'id,opportunity_id,assigned_to,assigned_by,visibility_mode,reason,started_at,ended_at',
  activities: 'id,opportunity_id,actor_id,type,body,from_status,to_status,created_at',
  follow_ups: 'id,opportunity_id,owner_id,due_at,action_type,status,completed_at',
  incorrect_reports: 'id,opportunity_id,reporter_id,reporter_role,reason_code,evidence,created_at',
  incorrect_reviews: 'id,opportunity_id,decision,reviewer_id,decision_reason,decided_at',
};

async function readAllPages(client: SupabaseClient, table: RelatedTable, opportunityIds: string[]): Promise<Row[]> {
  if (!opportunityIds.length) return [];
  // UUID filters are URL-encoded. Keep each query below common gateway URL
  // limits while fetching at most three independent batches per relation.
  if (opportunityIds.length > RELATED_ID_BATCH_SIZE) {
    const batches: string[][] = [];
    for (let start = 0; start < opportunityIds.length; start += RELATED_ID_BATCH_SIZE) batches.push(opportunityIds.slice(start, start + RELATED_ID_BATCH_SIZE));
    return (await Promise.all(batches.map((ids) => readAllPages(client, table, ids)))).flat();
  }
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await client.from(table).select(relatedColumns[table])
      .in('opportunity_id', opportunityIds).order('id').range(offset, offset + PAGE_SIZE - 1);
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

export async function readOpportunities(client: SupabaseClient, status?: string, options?: { limit?: number; offset?: number; after?: string }): Promise<Row[]> {
  const opportunities: Row[] = [];
  const limit = Math.max(1, Math.min(options?.limit ?? 250, 250));
  const offset = Math.max(0, options?.offset ?? 0);
  // An immutable key avoids skipping records when a lead is updated while the
  // browser is walking the pages. RLS remains enforced by the caller's client.
  let query = client.from('opportunities').select('*,contacts(*)').order('id').range(offset, offset + limit - 1);
  if (options?.after) query = query.gt('id', options.after);
  if (status) query = query.eq('status', status);
  const page = await query;
  if (page.error) throw page.error;
  opportunities.push(...((page.data ?? []) as unknown as Row[]));

  if (!opportunities.length) return opportunities;

  // Scope every history query to this page, not the entire workspace. Keep all
  // pages of each relation so dashboard metrics and permanent history are intact.
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
