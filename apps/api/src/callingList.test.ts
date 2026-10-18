import test from 'node:test';
import assert from 'node:assert/strict';
import type {AddressInfo} from 'node:net';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createApp} from './app.js';
import {readCallingList} from './callingList.js';
const uuid='00000000-0000-4000-8000-000000000001';
test('calling list returns only RLS-visible IDs and pages all contact methods',async()=>{
 const scopes:string[][]=[];
 const client={from(table:string){let offset=0;const q={select(){return q;},in(_field:string,ids:string[]){if(table!=='opportunities')scopes.push(ids);return q;},eq(){return q;},order(){return q;},range(start:number){offset=start;return q;},then(resolve:(value:unknown)=>unknown){const data=table==='opportunities'?[{id:uuid,status:'assigned',qualification:'sql',source:'Bark Paid',lead_category:'web',contacts:{name:'Test'},assignments:[]}]:table==='opportunity_contact_methods'?Array.from({length:offset===0?1000:1},(_,i)=>({id:`${offset+i}`,opportunity_id:uuid,health:'verified',focus:'active',contact_methods:{id:`${offset+i}`,method_type:'phone',value:'+12025550100',globally_restricted:false}})):[];return Promise.resolve({data,error:null}).then(resolve);}};return q;}} as unknown as SupabaseClient;
 const rows=await readCallingList(client,[uuid,'forbidden']);assert.equal(rows.length,1);assert.equal(rows[0].methods.length,1001);assert.ok(scopes.every(ids=>ids.length===1&&ids[0]===uuid));
});
for(const role of ['sales_agent','admin','marketer','manager'])test(`calling HTTP checks for ${role}`,async()=>{
 const calls:Array<{name:string;args:unknown}>=[];
 const client={auth:{getUser:async()=>({data:{user:{id:uuid}},error:null})},from(){const q={select(){return q;},eq(){return q;},maybeSingle:async()=>({data:{id:uuid,workspace_id:uuid,role,department:role==='manager'?'sales':null,active:true},error:null})};return q;},rpc:async(name:string,args:unknown)=>{calls.push({name,args});return{data:uuid,error:null};}} as unknown as SupabaseClient;
 const server=createApp(()=>client,()=>{throw Error('Must not use elevated client');}).listen(0,'127.0.0.1');
 try{await new Promise<void>(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;const headers={Authorization:'Bearer fake','Content-Type':'application/json'};
 const response=await fetch(`${base}/v1/calling-list/result`,{method:'POST',headers,body:JSON.stringify({opportunityId:uuid,contactMethodId:uuid,requestId:uuid,outcome:'no_answer'})});assert.equal(response.status,role==='sales_agent'||role==='admin'?200:403);assert.equal(calls.length,role==='sales_agent'||role==='admin'?1:0);if(calls.length){assert.equal(calls[0].name,'log_calling_result');assert.equal((calls[0].args as Record<string,unknown>).p_request_id,uuid);}
 const large=await fetch(`${base}/v1/calling-list`,{method:'POST',headers,body:JSON.stringify({ids:Array(101).fill(uuid)})});assert.equal(large.status,400);
 const invalid=await fetch(`${base}/v1/calling-list/result`,{method:'POST',headers,body:JSON.stringify({opportunityId:uuid,contactMethodId:uuid,outcome:'made_up'})});assert.equal(invalid.status,role==='sales_agent'||role==='admin'?400:403);
 if(role==='marketer'){const denied=await fetch(`${base}/v1/calling-list/export`,{method:'POST',headers,body:JSON.stringify({ids:[uuid],filters:'all'})});assert.equal(denied.status,403);}
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
