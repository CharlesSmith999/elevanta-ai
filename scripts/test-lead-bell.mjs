import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Install React 19.2.8, react-test-renderer 19.2.8 and esbuild in a temporary directory.
// Point BELL_TEST_MODULE_ROOT at that directory; no production dependency is added.
const require=createRequire(process.env.BELL_TEST_MODULE_ROOT ? join(process.env.BELL_TEST_MODULE_ROOT,'package.json') : import.meta.url);
const {build}=await import(require.resolve('esbuild'));
const {default:React}=await import(require.resolve('react'));
const {create,act}=await import(require.resolve('react-test-renderer'));
const output=join(await mkdtemp(join(tmpdir(),'elevanta-bell-')),'controller.mjs');
const source=new URL('../apps/web/src/LeadAlertController.tsx',import.meta.url).pathname;
await build({entryPoints:[source],bundle:true,platform:'node',format:'esm',jsx:'automatic',outfile:output,
 plugins:[{name:'test-boundaries',setup(b){
  b.onResolve({filter:/^react(?:\/.*)?$/},a=>({path:require.resolve(a.path),external:true}));
  b.onResolve({filter:/^(\.\/api|\.\/domain|@tabler\/icons-react)$/},a=>({path:a.path,namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='./api'?'export const loadRemoteLeads=(s)=>globalThis.harness.sales(s); export const loadResearchLeads=(s)=>globalThis.harness.research(s);':a.path==='./domain'?'export const ownerId=(lead)=>lead.assignments.find(a=>!a.endedAt)?.ownerId;':'export const IconBellRinging=()=>null; export const IconVolume=()=>null;'}));
 }}]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {LeadAlertController}=await import(output);
let store=new Map(),timers=new Map(),listeners=new Map(),sequence=0,starts=0,events=[];
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
class Audio {state='suspended';currentTime=0;destination={};resume(){this.state='running';return Promise.resolve()}close(){this.state='closed';return Promise.resolve()}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}createOscillator(){return{frequency:{setValueAtTime(){}},connect(){},start(){starts++},stop(){}}}}
globalThis.window={AudioContext:Audio,setTimeout:f=>{timers.set(++sequence,f);return sequence},clearTimeout:id=>timers.delete(id),addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k)},dispatchEvent:e=>events.push(e.type)};
globalThis.CustomEvent=class {constructor(type){this.type=type}};
const session={access_token:'synthetic'};
let notices=[],updates=[],records=[],leads=[],researchCalls=0,salesCalls=0;
globalThis.harness={research:async()=>{researchCalls++;return records},sales:async()=>{salesCalls++;return leads}};
const tick=async()=>{const work=[...timers.values()];timers.clear();await act(async()=>{work.forEach(f=>f());await Promise.resolve()})};
const mount=async user=>{let tree;await act(async()=>{tree=create(React.createElement(LeadAlertController,{session,user,onLeads:v=>updates.push(v),onNotice:v=>notices.push(v)}))});return tree};
const reset=()=>{store.clear();timers.clear();listeners.clear();starts=0;events=[];notices=[];updates=[];records=[];leads=[];researchCalls=0;salesCalls=0};
const finish=async t=>act(async()=>t.unmount());
reset();records=[{id:'old'}];let tree=await mount({id:'m',role:'marketer'});
assert.equal(tree.root.findByType('input').props.value,85);assert.equal(notices.length,0);assert.equal(starts,0);
records.push({id:'new'});await tick();assert.equal(notices.length,1);assert.equal(starts,0);assert.equal(events.length,1);
await act(async()=>listeners.get('pointerdown')());assert.equal(starts,6);
await tick();assert.equal(notices.length,1);assert.equal(starts,6);
records=[{id:'old'}];await tick();records.push({id:'new'});await tick();assert.equal(notices.length,1);
await finish(tree);console.log('PASS Research baseline, pending autoplay, batch bell, unchanged poll and repeat suppression');
reset();store.set('elevanta-lead-bell-claims-v1','null');store.set('elevanta-lead-bell-volume-v1','0');tree=await mount({id:'a',role:'admin'});assert.equal(tree.root.findByType('input').props.value,15);records=[{id:'one'}];await tick();assert.equal(notices.length,1);await finish(tree);console.log('PASS corrupted claim storage and minimum volume');
reset();tree=await mount({id:'s',role:'sales_agent'});await act(async()=>listeners.get('pointerdown')());
leads=[{assignments:[{id:'a1',ownerId:'other'}]}];await tick();assert.equal(notices.length,0);assert.equal(researchCalls,0);
leads.push({assignments:[{id:'a2',ownerId:'s'}]});await tick();assert.equal(notices.length,1);assert.equal(updates.length,1);assert.equal(starts,6);
await tick();assert.equal(updates.length,1);await finish(tree);console.log('PASS Sales receives only its own assignment, no Research query, no ordinary poll overwrite');
reset();tree=await mount({id:'sm',role:'manager',department:'sales'});assert.equal(tree.toJSON(),null);assert.equal(researchCalls+salesCalls,0);await finish(tree);console.log('PASS Sales Manager receives neither restricted alert stream');
reset();tree=await mount({id:'mm',role:'manager',department:'marketing'});assert.equal(researchCalls,1);assert.equal(salesCalls,0);await finish(tree);console.log('PASS Marketing Manager receives Research stream');
