import type { SupabaseClient } from '@supabase/supabase-js';
import { connectionAnalytics, type AnalyticsInput, type AnalyticsFilter, type Person } from './connectionAnalytics.js';

/** Server-only: never return these raw workspace rows to the browser. */
export async function readConnectionReport(client: SupabaseClient, viewer: Person, filter: AnalyticsFilter) {
  async function rows(table: string, columns: string) {
    const all: unknown[] = [];
    const child = ['assignments','activities'].includes(table);
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from(table).select(columns + (child ? ',opportunities!inner(workspace_id)' : '')).eq(child ? 'opportunities.workspace_id' : 'workspace_id', viewer.workspace_id).order('id').range(offset,offset+999);
      if (error) throw error;
      all.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return all;
  }
  const [people, opportunities, assignments, events, research] = await Promise.all([
    rows('profiles','id,workspace_id,full_name,role,department,manager_id'),
    rows('opportunities','id,workspace_id,marketing_owner_id,source,lead_category,status,lost_reason'),
    rows('assignments','id,opportunity_id,assigned_to,started_at,ended_at'),
    rows('activities','id,opportunity_id,actor_id,assignment_id,type,outcome,occurred_at,created_at,to_status,metadata'),
    rows('inbound_lead_candidates','id,workspace_id,source,lead_category,first_found_at,first_found_by,marketing_owner_id,published_opportunity_id,duplicate_state,discovered_methods,inbound_messages(received_at)'),
  ]);
  return connectionAnalytics(viewer, {people,opportunities,assignments,events,research} as AnalyticsInput, filter);
}
