import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.LEAD_WORKFLOW_TEST_URL || 'http://127.0.0.1:5189';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Only localhost is allowed');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const leads = [
    { id: 'recently-created', name: 'Recently Created', source: 'SEO', sourceDate: '2026-10-14T00:00:00Z', status: 'assigned', qualification: 'not_available', marketingOwnerId: 'yasir', priority: 0, assignments: [{ id: 'old-assignment', ownerId: 'asad', assignedBy: 'ali', at: '2026-09-01T00:00:00Z', visibility: 'full_context', reason: 'Assigned earlier' }], activities: [], followUps: [], incorrectReports: [] },
    { id: 'recently-assigned', name: 'Recently Assigned', source: 'Bark Paid', sourceDate: '2026-09-01T00:00:00Z', status: 'assigned', qualification: 'not_available', marketingOwnerId: 'muzammil', priority: 0, assignments: [{ id: 'new-assignment', ownerId: 'asad', assignedBy: 'ali', at: '2026-10-14T00:00:00Z', visibility: 'full_context', reason: 'Assigned today' }], activities: [], followUps: [], incorrectReports: [] },
  ];
  await page.addInitScript((data) => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify(data)), leads);
  await page.goto(base);
  await page.getByRole('combobox', { name: 'View as role' }).selectOption('asad');
  await page.getByRole('button', { name: 'Leads', exact: true }).click();

  const rows = page.locator('.lead-row.lead-button');
  assert.match(await rows.nth(0).innerText(), /Recently Assigned/);
  assert.match(await rows.nth(0).innerText(), /Assigned Oct 1[34]/);
  assert.match(await rows.nth(1).innerText(), /Recently Created/);
  assert.equal(await page.getByRole('combobox', { name: 'Sort' }).inputValue(), 'assigned');

  await rows.nth(0).click();
  await page.getByRole('heading', { name: 'Recently Assigned', exact: true }).waitFor();
  await page.locator('.lead-stage-control select').first().selectOption('lost');
  const reason = page.getByRole('combobox', { name: 'Lost reason' });
  await reason.waitFor();
  const confirm = page.getByRole('button', { name: 'Mark lead Lost', exact: true });
  assert.equal(await confirm.isEnabled(), false);
  await reason.selectOption({ label: 'Competitor selected' });
  assert.equal(await confirm.isEnabled(), true);
  await confirm.click();
  await page.locator('.status.lost').waitFor();

  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('elevanta-test-workspace-v1')));
  const updated = saved.find((lead) => lead.id === 'recently-assigned');
  assert.equal(updated.status, 'lost');
  assert.equal(updated.lostReason, 'Competitor selected');
  assert.deepEqual(errors, []);
  console.log('PASS: Sales leads default to latest assignment first, and Lost requires and saves a visible loss reason.');
} finally {
  await browser.close();
}
