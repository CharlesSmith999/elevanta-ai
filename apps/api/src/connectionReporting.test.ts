import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.js';
import { readConnectionReport } from './connectionReporting.js';
const actor='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
test('Reporting endpoint denies unauthenticated, inactive, non-admin preview and invalid filters before privileged reads',async()=>{
 let role='sales_agent',active=true,reads=0;
 const client={auth:{getUser:async()=>({data:{user:{id:actor}},error:null})},from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:actor,workspace_id:'w',role,department:'sales',active,full_name:'Synthetic'},error:null})})} as unknown as SupabaseClient;
 const server=createApp(()=>client,()=>{reads++;throw Error('Unexpected privileged read');}).listen(0,'127.0.0.1');
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/analytics/connections?end=2026-10-04T23:59:59Z&timezone=UTC`;
 const call=(suffix='',auth=true)=>fetch(url+suffix,{headers:auth?{authorization:'Bearer synthetic'}:{}});
 try {
  assert.equal((await call('',false)).status,401);
  assert.equal((await call(`&viewerId=${other}`)).status,403);
  active=false;assert.equal((await call()).status,403);active=true;
  assert.equal((await call('&start=2026-10-06T00:00:00Z')).status,400);
  assert.equal((await call('&viewerId=bad')).status,400);
  role='admin';assert.equal((await call('&start=bad')).status,400);assert.equal(reads,0);
 } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('Privileged reporting reads constrain every table to workspace, paginate and return only aggregates',async()=>{
 const calls:Array<{table:string;columns:string;field:string;value:unknown;offset:number}>=[];
 const client={from(table:string){let columns='',field='',value:unknown;const query={select(v:string){columns=v;return query;},eq(k:string,v:unknown){field=k;value=v;return query;},order(){return query;},async range(offset:number){calls.push({table,columns,field,value,offset});return {data:table==='profiles'&&offset===0?Array.from({length:1000},(_,i)=>({id:`s${i}`,workspace_id:'w',role:'sales_agent',department:'sales',manager_id:null,full_name:`Synthetic ${i}`})):[],error:null};}};return query;}} as unknown as SupabaseClient;
 const result=await readConnectionReport(client,{id:actor,workspace_id:'w',role:'sales_agent',department:'sales',manager_id:null,full_name:'Synthetic'},{end:'2026-10-04T23:59:59Z',timezone:'UTC'});
 assert.ok(calls.every(c=>c.value==='w'));assert.ok(calls.some(c=>c.table==='profiles'&&c.offset===1000));
 assert.ok(calls.filter(c=>['activities','assignments'].includes(c.table)).every(c=>c.field==='opportunities.workspace_id'&&c.columns.includes('!inner')));
 assert.equal(result.totals.connected,0);assert.equal(result.salesAgents.length,0);assert.ok(!JSON.stringify(result).includes('Synthetic 999'));
});
