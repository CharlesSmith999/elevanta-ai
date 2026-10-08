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
const firstFound=(await db.query('select first_found_at,first_found_by from inbound_lead_candidates where id=$1',[candidate])).rows[0];
check(Boolean(firstFound.first_found_at)&&firstFound.first_found_by===marketer,'first valid research save records finder and timestamp');
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
await db.query("insert into inbound_messages(workspace_id,provider_message_id,received_at,parser_version,processing_state,failure_code) values($1,'html-recovery',now(),'bark-plain-v1','needs_review','plain_text_missing')",[workspace]);
await db.exec('set role service_role');
check((await db.query('select * from gmail_recorded_ids($1,$2,$3)',[workspace,admin,['html-recovery']])).rows.length===0,'legacy failure remains eligible for repair');
await db.query(ingest,[workspace,admin,'html-recovery',payload]);
await db.query(ingest,[workspace,admin,'html-recovery',payload]);
check((await db.query('select * from gmail_recorded_ids($1,$2,$3)',[workspace,admin,['html-recovery']])).rows.length===1,'repaired message is not retried');
await db.exec('reset role');
check((await db.query("select c.id from inbound_lead_candidates c join inbound_messages m on m.id=c.inbound_message_id where m.provider_message_id='html-recovery'")).rows.length===1,'HTML recovery creates exactly one candidate');
await db.query("update inbound_lead_candidates set name='Recovered Synthetic' where inbound_message_id=(select id from inbound_messages where provider_message_id='html-recovery')");
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
await db.exec('reset role');
const beforeSwitch=(await db.query('select * from gmail_connections where workspace_id=$1',[workspace])).rows[0];
const oldCount=(await db.query('select count(*)::int n from inbound_lead_candidates')).rows[0].n;
const replaceMailbox='select gmail_replace_mailbox($1,$2,$3,$4)';
for(const actor of [marketer,manager,sales,inactive])await denied(replaceMailbox,[workspace,actor,'next@example.invalid',beforeSwitch.settings_revision],'non-admin replacement denied');
await denied(replaceMailbox,[workspace,admin,'bad',beforeSwitch.settings_revision],'invalid replacement denied');
await denied(replaceMailbox,[workspace,admin,null,beforeSwitch.settings_revision],'null replacement denied');
await denied(replaceMailbox,[workspace,admin,beforeSwitch.mailbox,beforeSwitch.settings_revision],'same mailbox denied');
await denied(replaceMailbox,[workspace,admin,'next@example.invalid',null],'missing revision denied');
await db.query(`insert into gmail_oauth_states values('synthetic-switch-state',$1,$2,'synthetic',$3,$4,now()+interval '10 minutes')`,[workspace,admin,beforeSwitch.mailbox,beforeSwitch.settings_revision]);
await db.query(replaceMailbox,[workspace,admin,' Next@Example.invalid ',beforeSwitch.settings_revision]);
const afterSwitch=(await db.query('select * from gmail_connections where workspace_id=$1',[workspace])).rows[0];
check(afterSwitch.mailbox==='next@example.invalid'&&!afterSwitch.enabled&&afterSwitch.encrypted_refresh_token===null,'replacement stops intake and clears stored token');
check(afterSwitch.lease_id===null&&afterSwitch.page_token===null&&afterSwitch.activated_at===null&&afterSwitch.settings_revision!==beforeSwitch.settings_revision,'replacement invalidates workers/cursors and authorization revision');
check(afterSwitch.message_prefix.endsWith(':')&&!afterSwitch.message_prefix.includes('@'),'namespace contains no mailbox identity');
check((await db.query('select * from gmail_oauth_states where workspace_id=$1',[workspace])).rows.length===0,'pending authorizations invalidated');
check((await db.query('select count(*)::int n from inbound_lead_candidates')).rows[0].n===oldCount,'all old research records preserved');
await denied(replaceMailbox,[workspace,admin,'third@example.invalid',beforeSwitch.settings_revision],'stale concurrent replacement denied');
await denied(ingest,[workspace,admin,'stale-after-switch',payload],'old worker cannot ingest after replacement');
const audit=(await db.query("select after_json from audit_events where action='gmail_mailbox_replaced'")).rows;
check(audit.length===1&&!JSON.stringify(audit).includes('@'),'one audit event with no private mailbox');
await asUser(admin);await denied(replaceMailbox,[workspace,admin,'third@example.invalid',afterSwitch.settings_revision],'browser Admin cannot bypass API actor validation');
await asUser(marketer);
const multiCreate = 'select create_opportunity_v21($1,$2::jsonb,$3,$4,$5,$6,$7) id';
const multiArgs = ['Multi-contact synthetic', JSON.stringify([{type:'phone',value:'2025550181'},{type:'phone',value:'2025550182'},{type:'email',value:'multi@example.test'}]),'Other',marketer,sales,'Synthetic request','web'];
const multiId = (await db.query(multiCreate,multiArgs)).rows[0].id;
check(Boolean(multiId),'atomic multi-contact creation succeeds');
await asUser(sales);
check((await db.query('select id from opportunities where id=$1',[multiId])).rows.length===1,'assigned Sales user sees multi-contact lead');
await denied(multiCreate,multiArgs,'Sales cannot create leads through multi-contact RPC');
await asUser(marketer);
for (const invalid of [[{type:'phone',value:'abc2025550181'}],[{type:'email',value:'masked***@example.test'}],[{type:'phone',value:'2025550181'},{type:'phone',value:'(202) 555-0181'}]]) {
  await denied(multiCreate,[...multiArgs.slice(0,1),JSON.stringify(invalid),...multiArgs.slice(2)],'invalid or duplicate methods rejected by database');
}
await db.exec('reset role');
await db.query('update inbound_lead_candidates set first_found_by=$1,first_found_at=now()+interval \'1 day\' where id=$2',[other,candidate]);
const stableFound=(await db.query('select first_found_at,first_found_by from inbound_lead_candidates where id=$1',[candidate])).rows[0];
check(String(stableFound.first_found_at)===String(firstFound.first_found_at)&&stableFound.first_found_by===marketer,'first-found attribution cannot be overwritten');
await db.query("update opportunities set qualification='mql' where id=$1",[multiId]);
await db.query("insert into activities(opportunity_id,actor_id,type,outcome,metadata) values($1,$2,'call','connected','{\"qualification_at_connection\":\"sql\"}')",[multiId,sales]);
check((await db.query("select metadata->>'qualification_at_connection' q from activities where opportunity_id=$1 and outcome='connected'",[multiId])).rows[0].q==='mql','connection captures database qualification, not client-supplied snapshot');
await asUser(admin);
const historicalManifest={format:'elevanta-history-v1',sourceSha256:'b'.repeat(64),workbookName:'synthetic-history.xlsx',expectedRows:8};
const historicalRows=[
  {recordId:'R000001',groupId:'G1',disposition:'ready',sourceSheet:'Synthetic',sourceRow:2,name:'Historical Safe',phones:['2025550191'],emails:['safe@example.test'],values:{Status:'Not available','Source Date':'2025-08-01T00:00:00','Date Basis':'Default missing date','Marketing Source':'Manager','Sales Owner':'Sales',Category:'Web',MQL:'Not available',SQL:'Not available',Details:'Historical note'},sourceLinks:[{Sheet:'Synthetic',Row:2}]},
  {recordId:'R000002',groupId:'G2',disposition:'ready',sourceSheet:'Synthetic',sourceRow:3,name:'Historical Incorrect',phones:['2025550192'],emails:[],values:{Status:'Incorrect','Source Date':'2025-08-02','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'App'},sourceLinks:[{Sheet:'Synthetic',Row:3}]},
  {recordId:'R000003',groupId:'G3',disposition:'ready',sourceSheet:'Synthetic',sourceRow:4,name:'Historical Unsupported',phones:['2025550193'],emails:[],values:{Status:'Refunded','Source Date':'2025-08-03','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'App'},sourceLinks:[{Sheet:'Synthetic',Row:4}]},
  {recordId:'R000004',groupId:'G4',disposition:'ready',sourceSheet:'Synthetic',sourceRow:5,name:'Historical Existing Contact Match',phones:['2025550181'],emails:[],values:{Status:'No Answer','Source Date':'2025-08-04','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'Web'},sourceLinks:[{Sheet:'Synthetic',Row:5}]},
  {recordId:'R000005',groupId:'G5',disposition:'ready',sourceSheet:'Synthetic',sourceRow:6,name:'Historical Repeated One',phones:['2025550194'],emails:[],values:{Status:'Connected','Source Date':'2025-08-05','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'Web'},sourceLinks:[{Sheet:'Synthetic',Row:6}]},
  {recordId:'R000006',groupId:'G6',disposition:'ready',sourceSheet:'Synthetic',sourceRow:7,name:'Historical Repeated Two',phones:['2025550194'],emails:[],values:{Status:'Connected','Source Date':'2025-08-06','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'Web'},sourceLinks:[{Sheet:'Synthetic',Row:7}]},
  {recordId:'R000007',groupId:'G7',disposition:'ready',sourceSheet:'Synthetic',sourceRow:8,name:'Historical No Answer',phones:['2025550195'],emails:[],values:{Status:'No Answer','Source Date':'2025-08-07','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales',Category:'Web'},sourceLinks:[{Sheet:'Synthetic',Row:8}]},
  {recordId:'R000008',groupId:'G8',disposition:'ready',sourceSheet:'Synthetic',sourceRow:9,name:'Historical Manager-Owned Win',phones:['2025550196'],emails:[],values:{Status:'Won','Source Date':'2025-08-08','Date Basis':'Recorded','Marketing Source':'Manager','Sales Owner':'Sales Manager',Category:'App'},sourceLinks:[{Sheet:'Synthetic',Row:9}]},
];
const historyBatch=(await db.query('select stage_historical_import($1::jsonb,$2::jsonb) id',[JSON.stringify(historicalManifest),JSON.stringify(historicalRows)])).rows[0].id;
await db.query('select seal_historical_import($1)',[historyBatch]);
const ownerMap={marketing:{Manager:manager},sales:{Sales:sales,'Sales Manager':salesmanager}};
const activate=()=>db.query('select activate_historical_import($1,$2::jsonb,100) result',[historyBatch,JSON.stringify(ownerMap)]);
const activationResult=(await activate()).rows[0].result;
check(activationResult.processed===8&&activationResult.activatedTotal===3&&activationResult.reviewTotal===5,'historical activation routes Incorrect, unsupported status, existing-contact collision, and within-batch duplicate identities to Admin review');
const imported=(await db.query("select o.status::text status,o.historical_source_status,o.historical_source_date,o.historical_date_basis,o.won_at,o.closed_at,o.qualified_at,o.first_contacted_at,o.proposal_sent_at from opportunities o where o.historical_import_batch_id=$1 order by o.historical_import_record_id limit 1",[historyBatch])).rows[0];
check(imported.status==='not_available'&&imported.historical_source_status==='Not available'&&new Date(imported.historical_source_date).toISOString().startsWith('2025-08-01')&&imported.historical_date_basis==='Default missing date','historical source date and original status are retained separately');
check(imported.won_at===null&&imported.closed_at===null&&imported.qualified_at===null&&imported.first_contacted_at===null&&imported.proposal_sent_at===null,'activation does not invent outcome or activity timestamps');
check((await db.query("select status::text from opportunities where historical_import_batch_id=$1 and historical_import_record_id='R000007'",[historyBatch])).rows[0].status==='no_answer','historical No Answer stays distinct from Incorrect');
const importedId=(await db.query('select id from opportunities where historical_import_batch_id=$1',[historyBatch])).rows[0].id;
check((await db.query('select count(*)::int n from assignments where opportunity_id=$1 and ended_at is null and assigned_to=$2',[importedId,sales])).rows[0].n===1,'historical activation creates exactly one active Sales owner');
const managerOwned=(await db.query("select id,status::text from opportunities where historical_import_batch_id=$1 and historical_import_record_id='R000008'",[historyBatch])).rows[0];
check(managerOwned.status==='won'&&(await db.query('select count(*)::int n from assignments where opportunity_id=$1 and ended_at is null and assigned_to=$2',[managerOwned.id,salesmanager])).rows[0].n===1,'approved manager-owned legacy opportunities retain the Sales Manager as sole owner');
check((await db.query('select total_project_cost,upfront_payment_amount,won_at,closed_at from opportunities where id=$1',[managerOwned.id])).rows[0].total_project_cost===null,'historical Won record preserves missing financial and outcome dates');
check((await db.query('select count(*)::int n from activities where opportunity_id=$1',[importedId])).rows[0].n===0&&(await db.query('select count(*)::int n from opportunity_stage_history where opportunity_id=$1',[importedId])).rows[0].n===0,'historical activation creates no fake activity or stage history');
check((await db.query('select count(*)::int n from lead_import_rows r join lead_import_activations a using(batch_id,record_id) where r.batch_id=$1 and a.state=\'review\' and r.payload->>\'recordId\' is not null',[historyBatch])).rows[0].n===5,'review decisions remain linked to immutable source records');
await db.query("update public.lead_import_activations set reason='Source date is absent or invalid' where batch_id=$1 and record_id='R000002'",[historyBatch]);
const recoveredResult=(await activate()).rows[0].result;
check(recoveredResult.processed===1&&recoveredResult.review===1&&recoveredResult.reviewTotal===5&&(await db.query("select reason from lead_import_activations where batch_id=$1 and record_id='R000002'",[historyBatch])).rows[0].reason==='Historical Incorrect requires Admin review; no independent CRM reports are fabricated','date-validation review can be safely rechecked and keeps Incorrect in Admin review');
const retryResult=(await activate()).rows[0].result;
check(retryResult.processed===0&&retryResult.activatedTotal===3&&retryResult.reviewTotal===5&&(await db.query('select count(*)::int n from opportunities where historical_import_batch_id=$1',[historyBatch])).rows[0].n===3,'historical activation retry is idempotent and reports cumulative totals');
await asUser(sales);
await denied('select activate_historical_import($1,$2::jsonb,100)',[historyBatch,JSON.stringify(ownerMap)],'Sales cannot activate staged history');
await asUser(admin);
await db.close();
