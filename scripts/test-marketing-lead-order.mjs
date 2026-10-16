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
  const lead = (id, name, assignedAt) => ({
    id,
    name,
    phone: '+12025550100',
    source: 'SEO',
    sourceDate: '2026-01-01',
    status: 'assigned',
    qualification: 'not_available',
    marketingOwnerId: 'yasir',
    priority: 0,
    assignments: [{ id: `assignment-${id}`, ownerId: 'asad', assignedBy: 'yasir', at: assignedAt, visibility: 'full_context', reason: 'Ordering test' }],
    activities: [],
    followUps: [],
    incorrectReports: [],
  });
  const leads = [
    lead('oldest', 'A Oldest Lead', '2026-08-01T10:00:00Z'),
    lead('newest', 'Z Newest Lead', '2026-10-16T10:00:00Z'),
    lead('middle', 'M Middle Lead', '2026-09-01T10:00:00Z'),
  ];
  await page.addInitScript((data) => localStorage.setItem('elevanta-test-workspace-v1', JSON.stringify(data)), leads);
  await page.goto(base);
  await page.getByRole('combobox', { name: 'View as role' }).selectOption('yasir');
  await page.getByRole('button', { name: 'Leads', exact: true }).click();
  const rows = page.locator('.lead-row.lead-button');
  await rows.first().waitFor();
  assert.equal(await page.locator('.lead-inbox-filters select').last().inputValue(), 'assigned');
  assert.deepEqual(await rows.locator('.lead-identity > span:last-child').allTextContents(), [
    'Z Newest LeadSEO · Not available',
    'M Middle LeadSEO · Not available',
    'A Oldest LeadSEO · Not available',
  ]);
  assert.deepEqual(errors, []);
  console.log('PASS: Marketing agents see their most recently assigned leads first.');
} finally {
  await browser.close();
}
