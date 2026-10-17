import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const id='00000000-0000-4000-8000-000000000001';const posted=[];
 await page.route('**/api/v1/calling-list',route=>route.fulfill({json:{records:[{id,name:'Retry Test',status:'assigned',qualification:'sql',category:'web',source:'Bark Paid',assignedAt:new Date().toISOString(),ownerId:id,blocked:false,methods:[{id,type:'phone',value:'+12025550100',health:'verified',focus:'active',restricted:false}],events:[],followUps:[]}]}}));
 await page.route('**/api/v1/calling-list/result',async route=>{posted.push(route.request().postDataJSON());await route.fulfill({status:posted.length===1?500:200,json:posted.length===1?{message:'Synthetic save failure'}:{activityId:id}});});
 await page.goto('http://127.0.0.1:5189');
 await page.evaluate(async id=>{
  const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');const {CallingView}=await import('/src/CallingView.tsx');
  const element=document.createElement('div');document.body.replaceChildren(element);
  ReactDOM.createRoot(element).render(React.createElement(CallingView,{viewer:{id,name:'Test',role:'sales_agent',department:'sales'},session:{access_token:'synthetic',user:{id}},leads:[{id}],ready:true,onDetails:()=>{},onSaved:()=>{}}));
 },id);
 await page.locator('.calling-row').waitFor();await page.getByRole('button',{name:'Log result',exact:true}).click();await page.getByRole('button',{name:'No Answer',exact:true}).click();await page.getByText('Synthetic save failure').waitFor();assert.equal(await page.locator('.calling-row').count(),1);
 await page.getByRole('button',{name:'Retry same save'}).click();await page.getByText('No numbers match this list. Try another tab or filter.').waitFor();assert.equal(posted.length,2);assert.equal(posted[0].requestId,posted[1].requestId);assert.equal(posted[0].contactMethodId,id);
 await page.getByRole('button',{name:/Called Today/}).click();assert.equal(await page.locator('.calling-row').count(),1);
 console.log('PASS failed server save keeps row and retry reuses idempotency key; successful retry moves row once');
}finally{await browser.close();}
