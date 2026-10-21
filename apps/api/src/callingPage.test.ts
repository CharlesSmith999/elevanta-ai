import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callingPageSchema, readCallingPage, readCallingExport } from './callingPage.js';

const input = callingPageSchema.parse({reportDay:'2026-10-20',timeZone:'America/New_York'});
test('calling page validates dates, timezone, pagination and outcome filters', () => {
  assert.equal(input.pageSize,30);
  for (const change of [{reportDay:'2026-02-30'},{timeZone:'not/a/zone'},{pageSize:1000},{page:-1},{outcomes:['invalid']}]) {
    assert.equal(callingPageSchema.safeParse({...input,...change}).success,false);
  }
});
test('calling page sends complete filters and preview scope to one authenticated RPC',async () => {
  const calls: unknown[] = [];
  const client = {rpc:async (name:string,args:unknown) => {calls.push({name,args});return {data:{rows:[],total:42},error:null};}} as unknown as SupabaseClient;
  const viewerId='00000000-0000-4000-8000-000000000001';
  const page=await readCallingPage(client,{...input,viewerId,page:2,outcomes:['never','busy'],query:'Some lead'});
  assert.equal(page.total,42);
  assert.deepEqual(calls,[{name:'calling_page_v1',args:{p_viewer_id:viewerId,p_page:2,p_page_size:30,p_tab:'todo',p_outcomes:['never','busy'],p_service:'all',p_query:'Some lead',p_report_day:'2026-10-20',p_timezone:'America/New_York'}}]);
});
test('explicit calling export pages beyond the current page and excludes unusable history',async () => {
  const pages:number[]=[];
  const client={rpc:async (_name:string,args:{p_page:number;p_page_size:number})=>{
    pages.push(args.p_page);assert.equal(args.p_page_size,50);
    return {data:{total:51,rows:[{usable:true,record:{id:`lead-${args.p_page}`}},{usable:false,record:{id:'blocked'}}]},error:null};
  }} as unknown as SupabaseClient;
  const records=await readCallingExport(client,{...input,page:5});
  assert.deepEqual(pages,[0,1]);assert.deepEqual(records.map(row=>row.id),['lead-0','lead-1']);
});
test('calling export refuses an oversized result instead of silently truncating',async () => {
  const client={rpc:async()=>({data:{total:20001,rows:[]},error:null})} as unknown as SupabaseClient;
  await assert.rejects(readCallingExport(client,input),/20,000/);
});
