import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.ASSIGNMENT_TEST_URL || 'http://127.0.0.1:5189';
if (!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Only localhost is allowed');
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors=[]; page.on('pageerror', error => errors.push(error.message));
  const leads = [
    {id:'one',name:'Alpha Company',source:'Bark Paid',status:'assigned',qualification:'not_available',marketingOwnerId:'yasir',priority:0,assignments:[{id:'old',ownerId:'owais',assignedBy:'yasir',at:'2026-09-01T00:00:00Z',endedAt:'2026-10-01T00:00:00Z',visibility:'full_context',reason:'Initial routing'},{id:'new',ownerId:'asad',assignedBy:'ali',at:'2026-10-01T00:00:00Z',visibility:'fresh_start',reason:'Reassigned for follow-up'}],activities:[],followUps:[],incorrectReports:[]},
    {id:'two',name:'Beta Studio',source:'SEO',status:'assigned',qualification:'mql',marketingOwnerId:'hamza',priority:0,assignments:[{id:'beta',ownerId:'mustabeen',assignedBy:'ali',at:'2026-10-02T00:00:00Z',visibility:'full_context',reason:'New request'}],activities:[],followUps:[],incorrectReports:[]},
  ];
  await page.addInitScript(data => localStorage.setItem('elevanta-test-workspace-v1',JSON.stringify(data)),leads);
  await page.goto(base);
  await page.getByRole('button',{name:'Assignments',exact:true}).click();
  await page.getByRole('heading',{name:'Lead ownership',exact:true}).waitFor();
  assert.equal(await page.locator('.assignment-table tbody tr').count(),2);
  assert.equal(await page.getByText('Alpha Company',{exact:true}).count(),1);
  assert.equal(await page.getByText('Fresh view',{exact:true}).count(),1);
  await page.getByPlaceholder('Lead, owner, source, or reason').fill('Beta');
  assert.equal(await page.getByText('Alpha Company',{exact:true}).count(),0);
  assert.equal(await page.getByText('Beta Studio',{exact:true}).count(),1);
  await page.getByPlaceholder('Lead, owner, source, or reason').fill('');
  await page.getByRole('button',{name:'Full history',exact:true}).click();
  assert.equal(await page.locator('.assignment-table tbody tr').count(),3);
  await page.screenshot({path:'/tmp/elevanta-assignments-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  const closeNav = page.getByRole('button',{name:'Close navigation',exact:true}).first();
  if (await closeNav.isVisible()) await closeNav.click();
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({path:'/tmp/elevanta-assignments-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: assignments summary, current/history views, search, responsive layout, and no browser errors');
} finally { await browser.close(); }
