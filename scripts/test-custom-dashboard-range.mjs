import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.DASHBOARD_TEST_URL || 'http://127.0.0.1:5189';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Only localhost is allowed');

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assignment = { id: 'assignment', ownerId: 'asad', assignedBy: 'ali', at: '2026-07-01T10:00:00Z', visibility: 'full_context', reason: 'Date test' };
  const lead = (id, sourceDate) => ({ id, name: id, phone: '+12025550100', source: 'SEO', sourceDate, status: 'assigned', qualification: 'not_available', marketingOwnerId: 'yasir', priority: 0, assignments: [{ ...assignment, id: `assignment-${id}` }], activities: [], followUps: [], incorrectReports: [] });
  await page.addInitScript((data) => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify(data)), [lead('First day', '2026-07-01T08:00:00.000Z'), lead('Last day evening', '2026-07-31T20:30:00.000Z'), lead('Outside range', '2026-08-01T00:00:00.000Z')]);
  await page.goto(base);
  await page.getByRole('combobox', { name: 'Period' }).selectOption('custom');
  const from = page.getByLabel('Custom range from');
  const to = page.getByLabel('Custom range to');
  await from.fill('2026-07-01');
  await to.fill('2026-07-31');
  await page.getByText('Dashboard updated for the selected dates.', { exact: true }).waitFor();
  const leadsCard = page.locator('.admin-reference-metric').filter({ hasText: 'Leads' });
  assert.match(await leadsCard.innerText(), /2/);
  await page.getByRole('combobox', { name: 'View as role' }).selectOption('asad');
  assert.equal(await page.getByLabel('Custom range from').inputValue(), '2026-07-01');
  assert.equal(await page.getByLabel('Custom range to').inputValue(), '2026-07-31');
  assert.deepEqual(errors, []);
  console.log('PASS: Custom date controls appear, preserve the selected dates across role dashboards, and include the complete end date.');
} finally {
  await browser.close();
}
