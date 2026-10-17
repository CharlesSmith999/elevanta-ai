import type { SupabaseClient } from '@supabase/supabase-js';

export type CallingMethod = { id: string; type: 'phone' | 'email'; value: string; health: string; focus: string; restricted: boolean };
export type CallingEvent = { id: string; methodId: string; actorId: string; at: string; outcome: string; body?: string };
export type CallingRecord = { id: string; name: string; status: string; qualification: string; source: string; category: string; assignedAt: string | null; ownerId: string | null; methods: CallingMethod[]; events: CallingEvent[]; followUps: Array<{ methodId: string | null; dueAt: string }>; blocked: boolean };
export function usableCallingMethod(method: CallingMethod): boolean {
  if (method.restricted || method.focus === 'removed' || ['incorrect', 'wrong_person', 'do_not_contact'].includes(method.health)) return false;
  const value = method.value.trim();
  return method.type === 'email' ? /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) : /^\+?[\d\s().-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;
}

// The caller's authenticated client enforces RLS for every read. Never use a service client here.
export async function readCallingList(client: SupabaseClient, ids: string[]): Promise<CallingRecord[]> {
  const result: CallingRecord[] = [];
  const unique = [...new Set(ids)];
  for (let start = 0; start < unique.length; start += 100) {
    const batch = unique.slice(start, start + 100);
    const opportunities = await client.from('opportunities').select('id,status,qualification,source,lead_category,routing_paused_at,contacts(name),assignments(assigned_to,started_at,ended_at)').in('id', batch).order('id');
    if (opportunities.error) throw opportunities.error;
    const visibleIds = (opportunities.data ?? []).map(row => row.id);
    if (!visibleIds.length) continue;
    const byLead = new Map<string, CallingMethod[]>();
    for (let offset = 0; ; offset += 1000) {
      const page = await client.from('opportunity_contact_methods').select('id,opportunity_id,health,focus,contact_methods(id,method_type,value,globally_restricted)').in('opportunity_id', visibleIds).order('id').range(offset, offset + 999);
      if (page.error) throw page.error;
      for (const row of page.data ?? []) {
        const raw = row.contact_methods as unknown as { id: string; method_type: 'phone' | 'email'; value: string; globally_restricted: boolean } | null;
        if (!raw) continue;
        const method = { id: raw.id, type: raw.method_type, value: raw.value, health: row.health, focus: row.focus, restricted: Boolean(raw.globally_restricted) };
        const methods = byLead.get(row.opportunity_id) ?? [];
        methods.push(method); byLead.set(row.opportunity_id, methods);
      }
      if ((page.data ?? []).length < 1000) break;
    }
    const events = new Map<string, CallingEvent[]>();
    const followUps = new Map<string, Array<{ methodId: string | null; dueAt: string }>>();
    for (let offset = 0; ; offset += 1000) {
      const page = await client.from('activities').select('id,opportunity_id,contact_method_id,actor_id,occurred_at,created_at,outcome,body,metadata').in('opportunity_id', visibleIds).eq('type', 'call').order('id').range(offset, offset + 999);
      if (page.error) throw page.error;
      for (const item of page.data ?? []) {
        if (!item.contact_method_id) continue;
        const list = events.get(item.opportunity_id) ?? [];
        list.push({ id: item.id, methodId: item.contact_method_id, actorId: item.actor_id, at: item.occurred_at ?? item.created_at, outcome: item.metadata?.calling_outcome ?? item.outcome ?? 'other', body: item.body ?? undefined }); events.set(item.opportunity_id, list);
      }
      if ((page.data ?? []).length < 1000) break;
    }
    for (let offset = 0; ; offset += 1000) {
      const page = await client.from('follow_ups').select('id,opportunity_id,contact_method_id,due_at').in('opportunity_id', visibleIds).eq('status', 'open').order('id').range(offset, offset + 999);
      if (page.error) throw page.error;
      for (const item of page.data ?? []) { const list = followUps.get(item.opportunity_id) ?? []; list.push({ methodId: item.contact_method_id, dueAt: item.due_at }); followUps.set(item.opportunity_id, list); }
      if ((page.data ?? []).length < 1000) break;
    }
    for (const row of opportunities.data ?? []) {
      const contact = row.contacts as unknown as { name: string } | null;
      const assignment = row.assignments.find(item => !item.ended_at);
      result.push({ id: row.id, name: contact?.name ?? '', status: row.status, qualification: row.qualification, source: row.source ?? '', category: row.lead_category ?? 'not_available', assignedAt: assignment?.started_at ?? null, ownerId: assignment?.assigned_to ?? null, blocked: Boolean(row.routing_paused_at) || ['incorrect', 'duplicate', 'do_not_contact', 'won', 'lost', 'not_interested'].includes(row.status), methods: byLead.get(row.id) ?? [], events: (events.get(row.id) ?? []).sort((a,b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)), followUps: followUps.get(row.id) ?? [] });
    }
  }
  const order = new Map(unique.map((id, index) => [id, index]));
  return result.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}
