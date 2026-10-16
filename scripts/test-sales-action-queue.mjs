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
  const assignment = { id: 'assignment', ownerId: 'asad', assignedBy: 'ali', at: '2026-10-16T10:00:00Z', visibility: 'full_context', reason: 'Queue test' };
  const lead = (id, status, followUps = []) => ({ id, name: id, phone: '+12025550100', source: 'SEO', sourceDate: '2026-10-16', status, qualification: 'not_available', marketingOwnerId: 'yasir', priority: 0, assignments: [{ ...assignment, id: `assignment-${id}` }], activities: [], followUps, incorrectReports: [] });
  const leads = [
    lead('No Answer Lead', 'no_answer'),
    lead('Not Available Lead', 'not_available'),
    lead('Qualified Lead', 'qualified'),
    lead('Future Follow-up Lead', 'connected', [{ id: 'future', ownerId: 'asad', dueAt: '2099-01-01T12:00:00Z', action: 'Call', status: 'open' }]),
    lead('Closed Lead', 'won'),
  ];
  await page.addInitScript((data) => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify(data)), leads);
  await page.goto(base);
  await page.getByRole('combobox', { name: 'View as role' }).selectOption('asad');
  await page.getByRole('button', { name: 'Leads', exact: true }).click();
  const rows = page.locator('.lead-row.lead-button');
  await rows.first().waitFor();
  assert.equal(await rows.filter({ hasText: 'No Answer Lead' }).count(), 1);
  assert.equal(await rows.filter({ hasText: 'Not Available Lead' }).count(), 1);
  assert.equal(await rows.filter({ hasText: 'Qualified Lead' }).count(), 1);
  assert.equal(await rows.filter({ hasText: 'Future Follow-up Lead' }).count(), 0);
  assert.equal(await rows.filter({ hasText: 'Closed Lead' }).count(), 0);
  assert.match(await page.locator('.lead-inbox-filters small').innerText(), /3 results/);
  assert.deepEqual(errors, []);
  console.log('PASS: Sales action queue includes every active lead without a future follow-up and excludes waiting or closed leads.');
} finally {
  await browser.close();
}
