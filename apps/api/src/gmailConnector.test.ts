import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {seal,unseal,validSchedulerSecret,gmailConfig,saveGmailMailbox,gmailHealth,replaceGmailMailbox,gmailMessageKey,setGmailEnabled,finishGmailConnection} from './gmailConnector.js';
import type { SupabaseClient } from '@supabase/supabase-js';

test('first activation starts now; resume and pause retain the original window with stale-write guards',async()=>{
 const original=process.env.GMAIL_LIVE_APPROVED;process.env.GMAIL_LIVE_APPROVED='true';
 try{
  for(const activated of [null,'2026-09-23T21:28:45.411Z'])for(const enabled of [true,false]){
   let payload:Record<string,unknown>={};const filters:unknown[][]=[];
   const query={select(){return query;},eq(...args:unknown[]){filters.push(['eq',...args]);return query;},is(...args:unknown[]){filters.push(['is',...args]);return query;},not(){return query;},update(value:Record<string,unknown>){payload=value;return query;},async maybeSingle(){return {data:{settings_revision:'revision',activated_at:activated},error:null};},then(resolve:(value:unknown)=>unknown){return Promise.resolve(resolve({data:[{workspace_id:'w'}],error:null}));}};
   await setGmailEnabled({from:()=>query} as unknown as SupabaseClient,'w',enabled);
   assert.equal(payload.enabled,enabled);assert.equal(payload.page_token,null);
   if(enabled&&!activated){assert.ok(Number.isFinite(Date.parse(String(payload.activated_at))));assert.equal(payload.scan_after,payload.activated_at);}
   else{assert.ok(!('activated_at' in payload));assert.ok(!('scan_after' in payload));}
   assert.ok(filters.some(f=>f[1]==='settings_revision'&&f[2]==='revision'));
   assert.ok(filters.some(f=>f[1]==='activated_at'&&f[2]===activated));
  }
 }finally{if(original===undefined)delete process.env.GMAIL_LIVE_APPROVED;else process.env.GMAIL_LIVE_APPROVED=original;}
});
test('activation rejects stale updates, missing rows and database errors',async()=>{
 const original=process.env.GMAIL_LIVE_APPROVED;process.env.GMAIL_LIVE_APPROVED='true';
 try{
  for(const mode of ['missing','stale','error']){
   const query={select(){return query;},eq(){return query;},is(){return query;},not(){return query;},update(){return query;},async maybeSingle(){return {data:mode==='missing'?null:{settings_revision:'r',activated_at:null},error:mode==='error'?{}:null};},then(resolve:(value:unknown)=>unknown){return Promise.resolve(resolve({data:[],error:null}));}};
   await assert.rejects(()=>setGmailEnabled({from:()=>query} as unknown as SupabaseClient,'w',true));
  }
 }finally{if(original===undefined)delete process.env.GMAIL_LIVE_APPROVED;else process.env.GMAIL_LIVE_APPROVED=original;}
});
test('callback requires the same-browser cookie before any database or Google access',async()=>{
 const db={from(){throw new Error('Database must not be called');}} as unknown as SupabaseClient;
 for(const cookie of ['', 'wrong'])await assert.rejects(()=>finishGmailConnection(db,'state',cookie,'code'),/expired/);
});
test('same-mailbox callback preserves activation/checkpoint and invalidates old lease',async()=>{
 const names=['GOOGLE_GMAIL_CLIENT_ID','GOOGLE_GMAIL_CLIENT_SECRET','GMAIL_REDIRECT_URI','GMAIL_TOKEN_KEY'];const previous=names.map(n=>process.env[n]);const originalFetch=globalThis.fetch;
 const key=randomBytes(32);Object.assign(process.env,{GOOGLE_GMAIL_CLIENT_ID:'test-id',GOOGLE_GMAIL_CLIENT_SECRET:'test-secret',GMAIL_REDIRECT_URI:'https://test.invalid/api/v1/inbound/gmail/callback',GMAIL_TOKEN_KEY:key.toString('base64')});
 let payload:Record<string,unknown>={};let calls=0;const filters:unknown[][]=[];
 globalThis.fetch=async()=>new Response(JSON.stringify(++calls===1?{access_token:'test-access',refresh_token:'test-refresh',scope:'https://www.googleapis.com/auth/gmail.readonly'}:{emailAddress:'test@example.invalid'}),{status:200});
 const state={workspace_id:'w',actor_id:'a',mailbox:'test@example.invalid',settings_revision:'r',verifier_cipher:seal('test-verifier',key,'w')};
 const db={from(table:string){const query={delete(){return query;},eq(...args:unknown[]){filters.push(args);return query;},gt(){return query;},select(){return table==='gmail_connections'?Promise.resolve({data:[{workspace_id:'w'}],error:null}):query;},update(value:Record<string,unknown>){payload=value;return query;},async maybeSingle(){return {data:table==='gmail_oauth_states'?state:{id:'a'},error:null};}};return query;}} as unknown as SupabaseClient;
 try{await finishGmailConnection(db,'state','state','code');assert.ok(!('activated_at' in payload));assert.ok(!('scan_after' in payload));assert.equal(payload.enabled,false);assert.equal(payload.page_token,null);assert.equal(payload.lease_id,null);assert.equal(payload.last_error,null);assert.ok(filters.some(f=>f[0]==='settings_revision'&&f[1]==='r'));assert.equal(calls,2);}
 finally{globalThis.fetch=originalFetch;names.forEach((n,i)=>{if(previous[i]===undefined)delete process.env[n];else process.env[n]=previous[i];});}
});
test('replacement uses actor/workspace/revision and never returns a credential',async()=>{
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{assert.equal(name,'gmail_replace_mailbox');assert.deepEqual(args,{p_workspace:'w',p_actor:'a',p_mailbox:'new@example.invalid',p_expected_revision:'r'});return {error:null};}} as unknown as SupabaseClient;
 assert.equal(await replaceGmailMailbox(db,'w','a','new@example.invalid','r'),undefined);
 const bad={rpc:async()=>({error:{message:'sensitive internal detail'}})} as unknown as SupabaseClient;
 await assert.rejects(()=>replaceGmailMailbox(bad,'w','a','new@example.invalid','r'),/Refresh status/);
});
test('message namespaces preserve legacy IDs and separate replacement mailboxes without exposing emails',()=>{
 assert.equal(gmailMessageKey(undefined,'same-id'),'same-id');
 assert.equal(gmailMessageKey('','same-id'),'same-id');
 assert.notEqual(gmailMessageKey('opaque-a:','same-id'),gmailMessageKey('opaque-b:','same-id'));
});
test('saving a mailbox needs no Google authorization or token configuration',async()=>{
 let called=false;
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{assert.equal(name,'gmail_save_mailbox');assert.equal(args.p_mailbox,'later@example.invalid');called=true;return {error:null};}} as unknown as SupabaseClient;
 await saveGmailMailbox(db,'workspace','admin','later@example.invalid');assert.equal(called,true);
});
test('health distinguishes a saved address from connection and never returns credentials',async()=>{
 let record:Record<string,unknown>={mailbox:'later@example.invalid',encrypted_refresh_token:null,enabled:false};
 const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:record,error:null};}};
 const db={from:()=>query} as unknown as SupabaseClient;
 assert.equal((await gmailHealth(db,'workspace')).connected,false);
 record={...record,encrypted_refresh_token:'private-encrypted-token'};
 const result=await gmailHealth(db,'workspace');assert.equal(result.connected,true);assert.ok(!JSON.stringify(result).includes('private-encrypted-token'));
});
test('Gmail secrets are encrypted, authenticated and workspace bound',()=>{
 const key=randomBytes(32);const token=seal('synthetic-refresh-token',key,'workspace-a');
 assert.ok(!token.includes('synthetic'));assert.equal(unseal(token,key,'workspace-a'),'synthetic-refresh-token');
 assert.throws(()=>unseal(token,key,'workspace-b'));assert.throws(()=>unseal(token,randomBytes(32),'workspace-a'));
 assert.notEqual(token,seal('synthetic-refresh-token',key,'workspace-a'));
 const parts=token.split('.');parts[2]=Buffer.from('tampered').toString('base64url');assert.throws(()=>unseal(parts.join('.'),key,'workspace-a'));
});
test('Scheduler denies missing, short and incorrect credentials',()=>{
 const secret='a'.repeat(32);
 assert.equal(validSchedulerSecret('Bearer '+secret,secret),true);
 for(const actual of [undefined,'Bearer wrong','Bearer '+secret+'x'])assert.equal(validSchedulerSecret(actual,secret),false);
 assert.equal(validSchedulerSecret('Bearer short','short'),false);assert.equal(validSchedulerSecret('Bearer anything',undefined),false);
});
test('Gmail configuration fails closed without exposing credentials',()=>{
 assert.throws(()=>gmailConfig({}),/incomplete/);
 const env={GOOGLE_GMAIL_CLIENT_ID:'id',GOOGLE_GMAIL_CLIENT_SECRET:'secret',GMAIL_EXPECTED_MAILBOX:'owner@example.invalid',GMAIL_TOKEN_KEY:randomBytes(32).toString('base64'),GMAIL_REDIRECT_URI:'https://crm.example.invalid/api/v1/inbound/gmail/callback'};
 assert.equal(gmailConfig(env).clientId,'id');
 assert.throws(()=>gmailConfig({...env,GMAIL_REDIRECT_URI:'http://crm.example.invalid/callback'}),/callback/);
 assert.throws(()=>gmailConfig({...env,GMAIL_TOKEN_KEY:'bad'}),/encryption/);
});
