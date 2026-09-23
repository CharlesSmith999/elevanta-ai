const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
const dir = new URL('../supabase/migrations', import.meta.url);
// PGlite cannot run background workers. These doubles test SQL/control flow only;
// real pg_cron/pg_net timing and HTTP delivery require production acceptance.
await db.exec(`create schema cron; create schema net; create schema vault;
create table cron.job(jobname text primary key,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$
 insert into cron.job values($1,$2,$3) on conflict(jobname) do update set schedule=$2,command=$3 returning 1::bigint $$;
create table vault.decrypted_secrets(name text,decrypted_secret text);
create table net._http_response(id bigint,status_code integer,timed_out boolean,error_msg text);
create table net.test_requests(id bigint generated always as identity,url text,headers jsonb,timeout_milliseconds integer);
create function net.http_get(url text,params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 2000) returns bigint language sql as $$
 insert into net.test_requests(url,headers,timeout_milliseconds) values($1,$3,$4) returning id $$;`);
for (const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) {
  const sql=(await readFile(new URL(file, new URL(dir.href + '/')),'utf8')).replace(/create extension if not exists (pgcrypto|pg_cron|pg_net);/g, '');
  try { await db.exec(sql); console.log('PASS migration',file); }
  catch(e) { console.error('FAIL migration',file,e.message); process.exit(1); }
}
const ids=Array.from({length:8},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
const [admin,manager,marketer,other,sales,salesmanager,outsider,inactive]=ids;
await db.exec(`insert into auth.users(id) values ${ids.map(id=>`('${id}')`).join(',')};
insert into workspaces(id,name) values ('10000000-0000-4000-8000-000000000001','Synthetic');
insert into profiles(id,workspace_id,full_name,role,department,manager_id,active) values
('${admin}','10000000-0000-4000-8000-000000000001','Admin','admin',null,null,true),
('${manager}','10000000-0000-4000-8000-000000000001','Manager','manager','marketing',null,true),
('${marketer}','10000000-0000-4000-8000-000000000001','Marketer','marketer','marketing','${manager}',true),
('${other}','10000000-0000-4000-8000-000000000001','Other','marketer','marketing',null,true),
('${salesmanager}','10000000-0000-4000-8000-000000000001','Sales manager','manager','sales',null,true),
('${sales}','10000000-0000-4000-8000-000000000001','Sales','sales_agent','sales','${salesmanager}',true),
('${inactive}','10000000-0000-4000-8000-000000000001','Inactive','marketer','marketing','${manager}',false);`);
const asUser=async id=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
const check=(condition,label)=>{if(!condition) throw Error(label);console.log('PASS',label)};
const denied=async(sql,params,label)=>{try{await db.query(sql,params)}catch(e){console.log('PASS',label,e.message);return}throw Error('Unexpected success: '+label)};
await asUser(marketer);
const create=`select create_inbound_candidate_v18($1,null,now(),'Synthetic',null,null,null,'Bark Stalk','web',null,'Synthetic description',null,$2,'{}') id`;
const candidate=(await db.query(create,['synthetic-message',marketer])).rows[0].id;
check((await db.query(create,['synthetic-message',marketer])).rows[0].id===candidate,'message replay is idempotent');
const update=`select update_inbound_candidate_v19($1,$2,'Synthetic','web',$3::jsonb,'[]',null,'clear',0)`;
await denied(update,[candidate,'ready_for_sales','[]'],'empty methods rejected');
await denied(update,[candidate,'sent_to_sales','[]'],'direct sent state rejected');
await denied(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'555***1234567'}])],'masked phone rejected');
await denied(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'5551234567'},{type:'phone',value:'(555) 123-4567'}])],'formatted duplicate rejected');
await db.query(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'5551234567'},{type:'email',value:'alexx@example.com'},{type:'phone',value:'5551234568'}])]);
for(const who of [sales,salesmanager,inactive]){
 await asUser(who);
 check((await db.query('select * from inbound_lead_candidates')).rows.length===0,'research rows hidden from '+who);
 check((await db.query('select * from inbound_messages')).rows.length===0,'messages hidden from '+who);
 await denied('select publish_inbound_candidate_v19($1,$2,1)',[candidate,sales],'unauthorized handoff rejected');
}
await asUser(other);
check((await db.query('select * from inbound_lead_candidates')).rows.length===1,'unrelated marketer sees shared queue');
await denied(update,[candidate,'researching','[]'],'stale research edit rejected');
await denied('select publish_inbound_candidate_v19($1,$2,0)',[candidate,sales],'stale handoff rejected');
await denied('select publish_inbound_candidate_v18($1,$2)',[candidate,sales],'legacy RPC cannot bypass revision guard');
await asUser(manager);
check((await db.query('select * from inbound_lead_candidates')).rows.length===1,'manager sees own team');
await asUser(other);
const opportunity=(await db.query('select publish_inbound_candidate_v19($1,$2,1) id',[candidate,sales])).rows[0].id;
check((await db.query('select publish_inbound_candidate_v19($1,$2,1) id',[candidate,sales])).rows[0].id===opportunity,'publication replay is idempotent');
await denied(update,[candidate,'researching','[]'],'published item locked');
await asUser(marketer);
check((await db.query('select publish_inbound_candidate_v19($1,$2,0) id',[candidate,sales])).rows[0].id===opportunity,'second marketer receives same handoff, no overwrite');
await asUser(sales);
check((await db.query('select * from opportunities where id=$1',[opportunity])).rows.length===1,'assigned Sales sees opportunity');
await db.exec('reset role');
await db.exec('set role service_role');
const mailboxWorkspace='10000000-0000-4000-8000-000000000001';
await denied('select gmail_save_mailbox($1,$2,$3)',[mailboxWorkspace,other,'synthetic@example.invalid'],'marketer cannot configure mailbox');
await denied('select gmail_save_mailbox($1,$2,$3)',[mailboxWorkspace,admin,'not-an-email'],'invalid mailbox rejected');
await db.query('select gmail_save_mailbox($1,$2,$3)',[mailboxWorkspace,admin,'Later@Example.invalid']);
const savedMailbox=(await db.query('select * from gmail_connections where workspace_id=$1',[mailboxWorkspace])).rows[0];
check(savedMailbox.mailbox==='later@example.invalid'&&!savedMailbox.enabled&&savedMailbox.encrypted_refresh_token===null,'save mailbox without credentials does not activate intake');
await db.query('select gmail_save_mailbox($1,$2,$3)',[mailboxWorkspace,admin,'second@example.invalid']);
check((await db.query('select settings_revision from gmail_connections where workspace_id=$1',[mailboxWorkspace])).rows[0].settings_revision!==savedMailbox.settings_revision,'mailbox changes invalidate pending OAuth settings revision');
await db.exec('reset role');
check((await db.query('select * from opportunity_contact_methods where opportunity_id=$1',[opportunity])).rows.length===3,'all contact methods preserved');
check((await db.query('select * from assignments where opportunity_id=$1 and ended_at is null',[opportunity])).rows.length===1,'one active assignment');
check((await db.query('select marketing_owner_id from opportunities where id=$1',[opportunity])).rows[0].marketing_owner_id===other,'publishing marketer owns normal CRM lead');
await asUser(admin);
await denied('select encrypted_refresh_token from gmail_connections',[],'even browser Admin cannot read Gmail tokens');
await denied("select * from gmail_claim_scan($1,$2)",['10000000-0000-4000-8000-000000000001',admin],'browser cannot start privileged ingestion');
await db.exec('reset role');
await db.query("update gmail_connections set encrypted_refresh_token='encrypted-fixture',enabled=true,activated_at=now()-interval '1 hour' where workspace_id=$1",['10000000-0000-4000-8000-000000000001']);
await db.exec('set role service_role');
await denied('select gmail_save_mailbox($1,$2,$3)',[mailboxWorkspace,admin,'replacement@example.invalid'],'connected mailbox cannot be overwritten');
const workspace='10000000-0000-4000-8000-000000000001';
check((await db.query('select * from gmail_claim_scan($1,$2)',[workspace,admin])).rows.length===1,'worker obtains scan lease');
check((await db.query('select * from gmail_claim_scan($1,$2)',[workspace,other])).rows.length===0,'concurrent worker cannot obtain lease');
const ingest="select gmail_record_message($1,$2,$3,null,now(),'parsed',$4::jsonb,null)";
const payload=JSON.stringify({name:'Inbound Synthetic',category:'web',maskedEmail:'a***@example.invalid'});
await denied(ingest,[workspace,other,'inbound-test',payload],'wrong lease cannot ingest');
await db.query(ingest,[workspace,admin,'inbound-test',payload]);
await db.query(ingest,[workspace,admin,'inbound-test',payload]);
await db.exec('reset role');
check((await db.query("select * from inbound_messages where provider_message_id='inbound-test'")).rows.length===1,'ingestion retry preserves one message');
check((await db.query("select marketing_owner_id from inbound_lead_candidates where name='Inbound Synthetic'")).rows[0].marketing_owner_id===null,'incoming Gmail lead is unowned');
await asUser(other);
check((await db.query("select * from inbound_lead_candidates where name='Inbound Synthetic'")).rows.length===1,'unowned incoming lead visible to Marketing');
await asUser(sales);
check((await db.query("select * from inbound_lead_candidates where name='Inbound Synthetic'")).rows.length===0,'unowned incoming lead hidden from Sales');
await denied('select gmail_private.dispatch()',[],'Sales cannot call scheduler');
await db.exec('reset role');
check((await db.query("select * from cron.job where jobname='elevanta-gmail-minute' and schedule='* * * * *'")).rows.length===1,'one minute job registered');
await db.exec('update gmail_connections set enabled=false; select gmail_private.dispatch();');
check((await db.query('select * from net.test_requests')).rows.length===0,'disabled intake sends no network request');
await db.exec('update gmail_connections set enabled=true; select gmail_private.dispatch();');
check((await db.query('select state from gmail_private.scheduler_state')).rows[0].state==='missing_secret','missing scheduler credential fails closed');
await db.query('insert into vault.decrypted_secrets values($1,$2)',['elevanta_gmail_cron_secret','synthetic-not-a-secret-for-testing-only']);
await db.exec('select gmail_private.dispatch();');
const dispatched=(await db.query('select * from net.test_requests')).rows[0];
check(dispatched.url==='https://elevanta-ai-pipeline.vercel.app/api/v1/internal/gmail/sync'&&dispatched.headers.Authorization==='Bearer synthetic-not-a-secret-for-testing-only'&&dispatched.timeout_milliseconds===55000,'fixed endpoint and Vault Bearer used');
await db.exec(`insert into net._http_response values(${dispatched.id},401,false,null); select gmail_private.dispatch();`);
check((await db.query('select state from gmail_private.scheduler_state')).rows[0].state==='http_error','HTTP auth failure not mistaken for cron success');
const nextRequest=(await db.query('select request_id from gmail_private.scheduler_state')).rows[0].request_id;
await db.exec(`insert into net._http_response values(${nextRequest},200,false,null); select gmail_private.dispatch();`);
check((await db.query('select state from gmail_private.scheduler_state')).rows[0].state==='delivered','HTTP result tracked separately from ingestion outcome');
await db.exec('set role service_role');
await denied('select * from gmail_private.scheduler_state',[],'ordinary backend cannot read scheduler state');
await db.close();
