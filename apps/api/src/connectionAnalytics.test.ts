import test from 'node:test';
import assert from 'node:assert/strict';
import {connectionAnalytics, type AnalyticsInput, type Person, type Event} from './connectionAnalytics.js';
const person=(id:string,role:string,department:string|null=null,manager_id:string|null=null):Person=>({id,role,department,manager_id,workspace_id:'w',full_name:id});
const admin=person('admin','admin'), marketer=person('m','marketer','marketing','mm'), seller=person('s','sales_agent','sales','sm');
const range={start:'2026-10-01T00:00:00Z',end:'2026-10-04T23:59:59Z',timezone:'UTC'};
const event=(id:string,day=2,extra:Partial<Event>={}):Event=>({id,opportunity_id:'o',actor_id:'s',assignment_id:'a',type:'call',outcome:'connected',occurred_at:`2026-10-0${day}T12:00:00Z`,created_at:`2026-10-0${day}T12:00:00Z`,metadata:{qualification_at_connection:'mql'},...extra});
const fixture=():AnalyticsInput=>({people:[admin,marketer,seller,person('mm','manager','marketing'),person('sm','manager','sales'),person('other','marketer','marketing'),person('s2','sales_agent','sales')],opportunities:[{id:'o',workspace_id:'w',marketing_owner_id:'m',source:'Bark Stalk',lead_category:'app',status:'connected',lost_reason:null}],assignments:[{id:'a',opportunity_id:'o',assigned_to:'s',started_at:'2026-10-01T09:00:00Z',ended_at:null}],events:[event('e')],research:[{id:'r',workspace_id:'w',source:'Bark Stalk',lead_category:'app',first_found_at:'2026-10-01T08:00:00Z',first_found_by:'m',marketing_owner_id:'m',published_opportunity_id:'o',duplicate_state:'clear',discovered_methods:[],inbound_messages:{received_at:'2026-10-01T07:00:00Z'}}]});
test('First connection counted once, zero days retained and daily average uses all days',()=>{
 const data=fixture();data.events.push(event('repeat',3),event('email',4,{type:'email',outcome:'replied'}));
 const report=connectionAnalytics(admin,data,range);
 assert.equal(report.totals.periodConnections,1);assert.equal(report.totals.dailyAverage,.25);assert.equal(report.totals.rate,100);
 assert.deepEqual(report.daily.map(d=>d.connected),[0,1,0,0]);assert.equal(report.daily[1].mql,1);assert.equal(report.marketingAgents.find(a=>a.id==='m')?.found,1);
});
test('Qualification alone, wrong actor, wrong interval and non-contact events never imply connection',()=>{
 for(const change of [{type:'qualification_change'},{actor_id:'m'},{occurred_at:'2026-09-30T12:00:00Z'},{outcome:'no_answer'}]){
  const data=fixture();data.events=[event('e',2,change)];assert.equal(connectionAnalytics(admin,data,range).totals.connected,0);
 }
});
test('Marketing handoff attribution survives current owner changes and Sales reassignment does not steal credit',()=>{
 const data=fixture();data.opportunities[0].marketing_owner_id='other';data.assignments[0].ended_at='2026-10-03T00:00:00Z';
 data.assignments.push({id:'a2',opportunity_id:'o',assigned_to:'s2',started_at:'2026-10-03T00:00:00Z',ended_at:null});data.events.push(event('e2',4,{actor_id:'s2',assignment_id:'a2'}));
 const result=connectionAnalytics(admin,data,range);
 assert.equal(result.marketingAgents.find(a=>a.id==='m')?.connected,1);assert.equal(result.salesAgents.find(a=>a.id==='s2')?.connected,0);assert.equal(result.salesAgents.find(a=>a.id==='s2')?.connectedByOther,1);assert.equal(result.totals.assigned,1);
});
test('Roles, manager teams, foreign workspace and raw research are isolated',()=>{
 const data=fixture();
 assert.equal(connectionAnalytics(marketer,data,range).marketingAgents.length,1);
 const sales=connectionAnalytics(seller,data,range);assert.deepEqual(sales.categories,[]);assert.deepEqual(sales.marketingAgents,[]);assert.equal(sales.salesAgents.length,1);assert.ok(!JSON.stringify(sales).includes('discovered_methods'));
 assert.equal(connectionAnalytics(person('other','marketer','marketing'),data,range).totals.connected,0);
 assert.equal(connectionAnalytics(person('mm','manager','marketing'),data,range).totals.connected,1);
 assert.equal(connectionAnalytics({...admin,workspace_id:'foreign'},data,range).totals.connected,0);
 assert.throws(()=>connectionAnalytics(person('bad','manager'),data,range));
});
test('Source filters, zero denominators and historical qualification gaps remain honest',()=>{
 const data=fixture();data.events[0].metadata={};
 assert.equal(connectionAnalytics(admin,data,range).missing.qualification,1);
 const empty=connectionAnalytics(admin,data,{...range,source:'SEO'});assert.equal(empty.totals.assigned,0);assert.equal(empty.totals.rate,null);assert.equal(empty.daily.length,4);
});
test('Losses outside period are not mislabeled missing; latest in-period reason wins',()=>{
 const data=fixture();data.opportunities[0].status='lost';data.events=[event('old',2,{occurred_at:'2026-09-20T00:00:00Z',type:'status_change',to_status:'lost'})];
 assert.equal(connectionAnalytics(admin,data,range).missing.lossDates,0);
 data.events.push(event('loss',3,{type:'status_change',to_status:'lost',metadata:{loss_reason:'Price or budget'}}));
 assert.deepEqual(connectionAnalytics(admin,data,range).losses,[{name:'Price or budget',count:1}]);
 data.events=[];assert.equal(connectionAnalytics(admin,data,range).missing.lossDates,1);
});
test('Timezone boundaries, exact source period and invalid ranges',()=>{
 const data=fixture();data.events[0].occurred_at='2026-10-02T01:00:00Z';
 const report=connectionAnalytics(admin,data,{...range,timezone:'America/New_York'});assert.equal(report.daily.find(d=>d.day==='2026-10-01')?.connected,1);
 assert.throws(()=>connectionAnalytics(admin,data,{...range,start:'bad'}));assert.throws(()=>connectionAnalytics(admin,data,{...range,timezone:'invalid'}));
});
