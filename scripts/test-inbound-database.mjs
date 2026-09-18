const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
const dir = new URL('../supabase/migrations', import.meta.url);
for (const file of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()) {
  const sql=(await readFile(new URL(file, new URL(dir.href + '/')),'utf8')).replace('create extension if not exists pgcrypto;', '');
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
const update=`select update_inbound_candidate_v18($1,$2,'Synthetic','web',$3::jsonb,'[]',null,'clear')`;
await denied(update,[candidate,'ready_for_sales','[]'],'empty methods rejected');
await denied(update,[candidate,'sent_to_sales','[]'],'direct sent state rejected');
await denied(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'555***1234567'}])],'masked phone rejected');
await denied(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'5551234567'},{type:'phone',value:'(555) 123-4567'}])],'formatted duplicate rejected');
await db.query(update,[candidate,'ready_for_sales',JSON.stringify([{type:'phone',value:'5551234567'},{type:'email',value:'alexx@example.com'},{type:'phone',value:'5551234568'}])]);
for(const who of [sales,salesmanager,other,inactive]){
 await asUser(who);
 check((await db.query('select * from inbound_lead_candidates')).rows.length===0,'research rows hidden from '+who);
 check((await db.query('select * from inbound_messages')).rows.length===0,'messages hidden from '+who);
 await denied('select publish_inbound_candidate_v18($1,$2)',[candidate,sales],'unauthorized handoff rejected');
}
await asUser(manager);
check((await db.query('select * from inbound_lead_candidates')).rows.length===1,'manager sees own team');
const opportunity=(await db.query('select publish_inbound_candidate_v18($1,$2) id',[candidate,sales])).rows[0].id;
check((await db.query('select publish_inbound_candidate_v18($1,$2) id',[candidate,sales])).rows[0].id===opportunity,'publication replay is idempotent');
await denied(update,[candidate,'researching','[]'],'published item locked');
await asUser(sales);
check((await db.query('select * from opportunities where id=$1',[opportunity])).rows.length===1,'assigned Sales sees opportunity');
await db.exec('reset role');
check((await db.query('select * from opportunity_contact_methods where opportunity_id=$1',[opportunity])).rows.length===3,'all contact methods preserved');
check((await db.query('select * from assignments where opportunity_id=$1 and ended_at is null',[opportunity])).rows.length===1,'one active assignment');
await db.close();
