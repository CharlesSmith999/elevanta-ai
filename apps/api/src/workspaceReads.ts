import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const viewerId = z.string().uuid().optional();
const timezone = z.string().max(80).default('UTC').refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Invalid timezone');
const dates = {
  start: z.string().datetime({ offset: true }).optional(), end: z.string().datetime({ offset: true }).optional(),
};
const common = { viewerId, limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(10_000_000).default(0), query: z.string().trim().max(200).default('') };
export const workspaceLeadQuery = z.object({ ...common, ...dates, timezone,
  status: z.string().max(40).default('all'), source: z.string().max(100).default('all'), owner: z.union([z.literal('all'),z.string().uuid()]).default('all'),
  queue: z.enum(['all','action','first','today','overdue','waiting','review','unassigned','assignments','followups','dataquality']).default('all'),
  sort: z.enum(['urgent','assigned','name','updated']).default('urgent'),
}).refine((value) => !value.start || !value.end || Date.parse(value.start)<=Date.parse(value.end), 'Start must not be after end');
export const workspaceResearchQuery = z.object({ ...common, source: z.string().max(100).default('all'),
  state: z.enum(['all','new','researching','found','not_found','connected','ready_for_sales','sent_to_sales','rejected']).default('all'),
  category: z.enum(['all','app','game','seo','smm','web','not_available']).default('all'),
  readiness: z.enum(['all','ready','needs_contact']).default('all'), duplicate: z.enum(['all','clear','possible','confirmed']).default('all'),
  recent: z.enum(['true','false']).default('false'),
});
export const workspaceSummaryQuery = z.object({ viewerId, ...dates, timezone,
  source:z.string().max(100).default('all'),status:z.string().max(40).default('all'),
  owner:z.union([z.literal('all'),z.string().uuid()]).default('all'),scope:z.enum(['company','marketing','sales']).default('company'),
}).refine((value) => !value.start || !value.end || Date.parse(value.start)<=Date.parse(value.end), 'Start must not be after end');
export const workspaceDetailQuery=z.object({viewerId});
export const workspaceAlertQuery=z.object({since:z.string().datetime({offset:true}).optional()});

export async function readWorkspace(client:SupabaseClient,kind:'leads'|'research'|'summary',query:{viewerId?:string;[key:string]:unknown}) {
  const {viewerId,...filters}=query;
  const rpc=kind==='leads'?'workspace_leads_page_v1':kind==='research'?'workspace_research_page_v1':'workspace_summary_v1';
  const {data,error}=await client.rpc(rpc,{p_viewer_id:viewerId??null,p_filters:filters});
  if(error)throw error;
  return data;
}
export async function readWorkspaceDetail(client:SupabaseClient,kind:'lead'|'research',id:string,viewerId?:string){
  const {data,error}=await client.rpc(kind==='lead'?'workspace_lead_detail_v1':'workspace_research_detail_v1',{p_id:id,p_viewer_id:viewerId??null});
  if(error)throw error;return data;
}
export async function readWorkspaceAlerts(client:SupabaseClient,since?:string){
  const {data,error}=await client.rpc('workspace_alerts_v1',{p_since:since??null});
  if(error)throw error;return data;
}
