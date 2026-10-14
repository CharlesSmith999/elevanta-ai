import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:5189';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const context = await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  await context.route('**/*', r => new URL(r.request().url()).origin === base ? r.continue() : r.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify([{id:'shortcut-test',name:'Shortcut Test',phone:'+12025550100',email:'demo@example.test',source:'Bark Paid',category:'web',status:'assigned',qualification:'not_available',marketingOwnerId:'yasir',priority:0,assignments:[{id:'a',ownerId:'asad',assignedBy:'yasir',at:'2026-10-01T00:00:00Z',visibility:'full_context',reason:'Test'}],activities:[],followUps:[],incorrectReports:[]}])));
  await page.goto(base);
  await page.getByRole('combobox',{name:'View as role'}).selectOption('asad');
  await page.getByRole('button',{name:'Leads',exact:true}).click();
  assert.equal(await page.locator('.sales-workbench').count(),0);
  await page.getByRole('button',{name:/Shortcut Test.*Open/}).click();
  await page.getByRole('heading',{name:'Who can I contact?',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Dial +12025550100',exact:true}).getAttribute('href'),'tel:+12025550100');
  assert.equal(await page.getByRole('link',{name:'Email demo@example.test',exact:true}).getAttribute('href'),'mailto:demo%40example.test');
  await page.getByRole('button',{name:'Copy +12025550100',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'+12025550100');
  assert.equal(await page.getByRole('button',{name:'Copy demo@example.test',exact:true}).count(),1);
  await page.getByRole('button',{name:'Lead inbox',exact:true}).click();
  await page.getByRole('button',{name:/Shortcut Test.*Open/}).waitFor();
  const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('elevanta-test-workspace-v1')));
  assert.equal(saved[0].activities.length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS: Previous lead list/detail restored; Copy clipboard works; Dial/Email destinations correct; no activity added; no browser errors.');
} finally { await browser.close(); }
