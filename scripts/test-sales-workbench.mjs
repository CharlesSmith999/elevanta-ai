// Localhost-only browser acceptance with synthetic contacts. No production sign-in or outreach.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WORKBENCH_TEST_URL || 'http://127.0.0.1:5188';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Only a localhost test server is allowed');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
const page = await context.newPage();
page.setDefaultTimeout(7000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const method = (id, value, extra = {}) => ({ id, type: 'phone', value, focus: 'active', health: 'verified', ...extra });
const leads = ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({ id: `sample-${i}`, name, source: 'Bark Paid', sourceDate: '2026-10-01', category: 'web', status: 'assigned', qualification: 'mql', marketingOwnerId: 'yasir', priority: 0, assignments: [{ id: `a-${i}`, ownerId: 'asad', assignedBy: 'yasir', at: '2026-10-10T00:00:00Z', visibility: 'fresh_start', reason: 'Synthetic' }], activities: [{ id: `old-${i}`, at: '2026-10-01T00:00:00Z', actorId: 'owais', kind: 'note', body: 'PRIVATE PRIOR CONVERSATION' }], followUps: [], incorrectReports: [], contactMethods: [method(`m-${i}`, `+1202555010${i}`), method(`blocked-${i}`, '+12025550999', { health: 'incorrect', focus: 'removed' }), { id: `e-${i}`, type: 'email', value: 'demo@example.test', health: 'unverified', focus: 'active' }] }));
try {
  await page.addInitScript(data => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify(data)), leads);
  await page.goto(base);
  await page.getByRole('combobox', { name: 'View as role' }).selectOption('asad');
  await page.getByRole('button', { name: 'Leads', exact: true }).click();
  const panel = () => page.locator('.workbench-panel');
  await panel().getByRole('heading', { name: 'Alpha', exact: true }).waitFor();
  assert.equal(await panel().getByRole('link', { name: 'Call +12025550999', exact: true }).count(), 0);
  assert.equal(await panel().getByRole('link', { name: 'WhatsApp +12025550100', exact: true }).getAttribute('href'), 'https://wa.me/12025550100');
  await panel().getByText('Recent activity (0)', { exact: true }).click();
  assert.equal(await panel().getByText('PRIVATE PRIOR CONVERSATION', { exact: true }).count(), 0);
  await panel().getByLabel('Notes', { exact: true }).fill('Keep this draft');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: /^Beta Bark/ }).click();
  assert.equal(await panel().getByLabel('Notes', { exact: true }).inputValue(), 'Keep this draft');
  await page.getByLabel('Search', { exact: true }).fill('Beta');
  await panel().getByText('This lead is outside your current filters.', { exact: false }).waitFor();
  assert.equal(await panel().getByLabel('Notes', { exact: true }).inputValue(), 'Keep this draft');
  await page.getByLabel('Search', { exact: true }).fill('');
  await panel().getByLabel('Outcome', { exact: true }).selectOption('no_answer');
  const future = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await panel().getByLabel('Next follow-up (optional)', { exact: true }).fill(future);
  await panel().getByRole('button', { name: 'Save and Next', exact: true }).click();
  await panel().getByRole('heading', { name: 'Beta', exact: true }).waitFor();
  let saved = JSON.parse(await page.evaluate(() => localStorage.getItem('elevanta-test-workspace-v1')));
  assert.equal(saved[0].followUps.length, 1);
  assert.equal(saved[0].activities.length, 2);
  const progress = panel().getByRole('form', { name: 'Lead progress' });
  await progress.getByLabel('Status', { exact: true }).selectOption('won');
  await progress.getByLabel('Total project cost').fill('100');
  await progress.getByLabel('Upfront payment').fill('200');
  await progress.getByRole('button', { name: 'Save progress', exact: true }).click();
  await panel().getByText('Enter total and upfront amounts. Upfront cannot exceed the total.').waitFor();
  await progress.getByLabel('Upfront payment').fill('20');
  await progress.getByRole('button', { name: 'Save progress', exact: true }).click();
  await panel().getByText('Progress saved.', { exact: true }).waitFor();
  saved = JSON.parse(await page.evaluate(() => localStorage.getItem('elevanta-test-workspace-v1')));
  assert.equal(saved[1].status, 'won');
  assert.equal(saved[1].upfrontPaymentAmount, 20);
  await page.screenshot({ path: '/tmp/elevanta-workbench-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const closeNav = page.getByRole('button', { name: 'Close navigation', exact: true }).first();
  if (await closeNav.isVisible()) await closeNav.click();
  await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile has no horizontal overflow');
  await page.locator('.workbench-panel').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/tmp/elevanta-workbench-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: /^Gamma Bark/ }).click();
  assert.equal(await panel().getByRole('button', { name: 'Save and Next', exact: true }).isDisabled(), true);
  console.log('PASS: App integration, restrictions, fresh-start history, dirty selection/filter guards, Save and Next, follow-up, Won validation, last record, mobile width');

  // Mount the real component with a fake session. Intercept every API call locally.
  const remoteId = 'a99c0011-2222-4333-8444-555566667777';
  let failWrite = true, failRead = false, writes = 0;
  const remoteLead = { ...leads[0], id: remoteId, assignments: [{ ...leads[0].assignments[0], ownerId: 'agent' }], contactMethods: [method('b99c0011-2222-4333-8444-555566667777', '+12025550100')] };
  await page.route('**/api/v1/opportunities/**', async route => {
    if (route.request().method() === 'POST') {
      writes++;
      return route.fulfill({ status: failWrite ? 503 : 201, contentType: 'application/json', body: JSON.stringify(failWrite ? { message: 'Synthetic save failure' } : { activityId: 'saved' }) });
    }
    return route.fulfill({ status: failRead ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failRead ? { message: 'Synthetic refresh failure' } : { opportunity: { id: remoteId, status: 'assigned', qualification: 'mql', created_at: '2026-10-01', updated_at: '2026-10-01', contacts: { name: 'Alpha' }, assignments: [{ id: 'a', assigned_to: 'agent', assigned_by: 'yasir', started_at: '2026-10-10', visibility_mode: 'fresh_start' }], activities: [], opportunity_contact_methods: [] } }) });
  });
  await page.evaluate(async ({ remoteLead }) => {
    const React = await import('/node_modules/.vite/deps/react.js');
    const ReactDOM = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { SalesWorkbench } = await import('/src/SalesWorkbench.tsx');
    const host = document.createElement('div');
    document.body.replaceChildren(host);
    const viewer = { id: 'agent', name: 'Synthetic Sales', role: 'sales_agent', department: 'sales' };
    (ReactDOM.default ?? ReactDOM).createRoot(host).render((React.default ?? React).createElement(SalesWorkbench, { leads: [remoteLead], viewer, session: { access_token: 'synthetic', user: { id: 'agent' } }, connected: true, onSelect() {}, onAdvance() {}, onDetails() {}, onGuard() {}, onSaved() {} }));
  }, { remoteLead });
  await panel().getByLabel('Outcome', { exact: true }).selectOption('no_answer');
  await panel().getByLabel('Notes', { exact: true }).fill('Draft survives server failure');
  await panel().getByRole('button', { name: 'Save activity', exact: true }).click();
  await panel().getByText('Synthetic save failure', { exact: false }).waitFor();
  assert.equal(await panel().getByLabel('Notes', { exact: true }).inputValue(), 'Draft survives server failure');
  assert.equal(writes, 1);
  failWrite = false; failRead = true;
  await panel().getByRole('button', { name: 'Save activity', exact: true }).click();
  await panel().getByRole('button', { name: 'Refresh saved lead', exact: true }).waitFor();
  assert.equal(await panel().getByLabel('Notes', { exact: true }).inputValue(), '');
  assert.equal(await panel().getByRole('button', { name: 'Save activity', exact: true }).isDisabled(), true);
  assert.equal(writes, 2);
  failRead = false;
  await panel().getByRole('button', { name: 'Refresh saved lead', exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(writes, 2, 'Refresh must never repeat the write');
  assert.deepEqual(errors, []);
  console.log('PASS: Failed writes preserve drafts; confirmed writes with failed refresh cannot be duplicated by refresh; no browser errors');
} catch (error) { console.error((await page.locator('body').innerText()).slice(-7000)); console.error('Browser errors:', errors); throw error; }
finally { await browser.close(); }
