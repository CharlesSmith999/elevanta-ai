import test from 'node:test';
import assert from 'node:assert/strict';
import {callingRows,callTab,callMetrics,callingCsv,localDay,type CallingRecord} from './callingModel';
const now=new Date('2026-10-16T12:00:00'); const day=localDay(now);
const lead:CallingRecord={id:'lead',name:'=DANGER()',category:'web',status:'assigned',qualification:'sql',source:'Bark Paid',assignedAt:now.toISOString(),ownerId:'agent',blocked:false,methods:[{id:'phone1',type:'phone',value:'+12025550101',health:'unverified',focus:'active',restricted:false},{id:'phone2',type:'phone',value:'+12025550102',health:'verified',focus:'active',restricted:false}],events:[],followUps:[]};
test('each number has its own result and saved calls move out of To Call',()=>{
 const data={...lead,events:[{id:'call',methodId:'phone1',actorId:'agent',at:now.toISOString(),outcome:'no_answer'}]};const rows=callingRows([data],day);
 assert.equal(rows[0].latest?.outcome,'no_answer');assert.equal(rows[1].latest,undefined);
 assert.equal(callTab(rows[0],'todo',now),false);assert.equal(callTab(rows[0],'called',now),true);assert.equal(callTab(rows[1],'todo',now),true);assert.equal(data.qualification,'sql');
});
test('wrong number remains in Called Today history but cannot be called',()=>{
 const data={...lead,methods:[{...lead.methods[0],health:'wrong_person',focus:'removed'}],events:[{id:'call',methodId:'phone1',actorId:'agent',at:now.toISOString(),outcome:'wrong_number'}]};const [row]=callingRows([data],day);
 assert.equal(row.usable,false);assert.equal(callTab(row,'called',now),true);assert.equal(callTab(row,'todo',now),false);
});
test('future callback stays out of To Call until due; midnight is local',()=>{
 const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);
 const data={...lead,followUps:[{methodId:'phone1',dueAt:tomorrow.toISOString()}]};
 const [row]=callingRows([data],day);assert.equal(callTab(row,'todo',now),false);assert.equal(callTab(row,'followup',now),true);assert.equal(callTab(row,'todo',tomorrow),true);
});
test('metrics deduplicate activity IDs, scope actor and count actual distinct numbers',()=>{
 const events=[{id:'a',methodId:'phone1',actorId:'agent',at:now.toISOString(),outcome:'connected'},{id:'b',methodId:'phone1',actorId:'agent',at:now.toISOString(),outcome:'no_answer'},{id:'c',methodId:'phone2',actorId:'other',at:now.toISOString(),outcome:'connected'}];
 assert.deepEqual(callMetrics([{...lead,events},{...lead,events}],day,'agent'),{attempts:2,unique:1,connected:1,rate:50});assert.equal(callMetrics([lead],day).rate,0);
});
test('invalid, blocked and removed numbers excluded and CSV prevents spreadsheet formulas',()=>{
 for(const health of ['wrong_person','incorrect','do_not_contact'])assert.equal(callingRows([{...lead,methods:[{...lead.methods[0],health}]}],day)[0].usable,false);
 assert.equal(callingRows([{...lead,blocked:true}],day)[0].usable,false);
 assert.equal(callingRows([{...lead,methods:[{...lead.methods[0],value:'javascript:123456789'}]}],day)[0].usable,false);
 const csv=callingCsv([lead]);assert.ok(csv.includes("'=DANGER()"));assert.ok(csv.includes("'+12025550101"));
});
