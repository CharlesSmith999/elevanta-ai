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
test('Daily App, other and all-category arrivals reconcile; discoveries are scoped and duplicates excluded',()=>{
 const data=fixture();
 data.research.push({...data.research[0],id:'web',lead_category:'web'}, {...data.research[0],id:'seo',lead_category:'seo',first_found_by:'other'}, {...data.research[0],id:'dup',duplicate_state:'confirmed'});
 const report=connectionAnalytics(marketer,data,range), day=report.daily[0];
 assert.equal(day.received,2);assert.equal(day.otherReceived,2);assert.equal(day.allReceived,4);
 assert.equal(day.allFound,2);assert.equal(day.found,1);assert.equal(report.daily[1].appConnected,1);
 assert.equal(report.daily[2].allReceived,0);assert.equal(report.researchFunnel?.excludedDuplicates,1);
});
test('Research funnel uses arrival cohort with personal finder and named connecting agent',()=>{
 const data=fixture();
 data.research.push({...data.research[0],id:'pending',first_found_at:null,first_found_by:null,published_opportunity_id:null}, {...data.research[0],id:'legacy',first_found_at:null,first_found_by:null,discovered_methods:['legacy'],published_opportunity_id:null}, {...data.research[0],id:'peer',first_found_by:'other',published_opportunity_id:null}, {...data.research[0],id:'old',inbound_messages:{received_at:'2026-09-01T00:00:00Z'}});
 const funnel=connectionAnalytics(marketer,data,range).researchFunnel!;
 assert.equal(funnel.received,4);assert.equal(funnel.notFound,1);assert.equal(funnel.unknown,1);assert.equal(funnel.found,1);assert.equal(funnel.routed,1);assert.equal(funnel.connected,1);
 assert.deepEqual(funnel.finders,[{name:'m',found:1,routed:1,connected:1}]);assert.deepEqual(funnel.connections,[{finder:'m',salesperson:'s',connected:1}]);
 assert.equal(connectionAnalytics(seller,data,range).researchFunnel,null);
 assert.ok(connectionAnalytics(seller,data,range).daily.every(row=>row.allReceived===0&&row.allFound===0&&row.appConnected===0));
});
test('Connected-to-Won counts one documented outcome and never infers a win from current status',()=>{
 const data=fixture();data.opportunities[0].status='won';
 assert.equal(connectionAnalytics(seller,data,range).conversion.won,0);
 data.events.push(event('win',3,{type:'status_change',to_status:'won',outcome:null}), event('winAgain',4,{type:'status_change',to_status:'won',outcome:null}));
 assert.deepEqual(connectionAnalytics(seller,data,range).conversion,{connected:1,won:1,wonByOther:0,rate:100});
});
test('Win evidence before connection, after period, from wrong actor or assignment is excluded',()=>{
 for(const extra of [{occurred_at:'2026-10-01T10:00:00Z'}, {occurred_at:'2026-10-05T10:00:00Z'}, {actor_id:'m'}, {assignment_id:'wrong'}]){
  const data=fixture();data.events.push(event('win',3,{type:'status_change',to_status:'won',outcome:null,...extra}));
  assert.equal(connectionAnalytics(seller,data,range).conversion.won,0);
 }
});
test('Reassigned win is disclosed but not credited to the first Sales Agent',()=>{
 const data=fixture();data.assignments[0].ended_at='2026-10-03T00:00:00Z';data.assignments.push({id:'a2',opportunity_id:'o',assigned_to:'s2',started_at:'2026-10-03T00:00:00Z',ended_at:null});
 data.events.push(event('win',4,{type:'status_change',to_status:'won',outcome:null,actor_id:'s2',assignment_id:'a2'}));
 assert.deepEqual(connectionAnalytics(seller,data,range).conversion,{connected:1,won:0,wonByOther:1,rate:0});
 assert.equal(connectionAnalytics(admin,data,range).conversion.won,1);
});
test('New comparisons honor source, workspace, timezone and empty cohorts',()=>{
 const data=fixture();data.research[0].inbound_messages={received_at:'2026-10-02T01:00:00Z'};
 const local=connectionAnalytics(marketer,data,{...range,timezone:'America/New_York'});assert.equal(local.daily.find(row=>row.day==='2026-10-01')?.allReceived,1);
 const empty=connectionAnalytics(marketer,data,{...range,source:'SEO'});assert.equal(empty.researchFunnel?.received,0);assert.equal(empty.conversion.rate,null);
 const foreign=connectionAnalytics({...admin,workspace_id:'foreign'},data,range);assert.equal(foreign.researchFunnel?.received,0);assert.equal(foreign.conversion.connected,0);
});
