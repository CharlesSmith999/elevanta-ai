import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('aggregate dashboard renders complete counts, all report screens, and truthful loading states', async () => {
  // Attach HMR to an unbound HTTP server. Rendering tests never open a socket.
  const http = createHttpServer();
  const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), server: { middlewareMode: true, hmr: { server: http } }, appType: 'custom' });
  try {
    const { RemoteDashboard } = await vite.ssrLoadModule('/src/RemoteDashboard.tsx');
    const viewer = { id: 'admin', name: 'Admin', role: 'admin', department: 'sales' };
    const noop = () => {};
    const props = { viewer, viewers: [viewer], period: 'lifetime', customStart: '', customEnd: '', source: 'all', theme: 'light', onRetry: noop, onViewer: noop, onPeriod: noop, onCustomStart: noop, onCustomEnd: noop, onSource: noop, onTheme: noop, onNavigate: noop };
    const render = (overrides = {}) => renderToStaticMarkup(createElement(RemoteDashboard, { ...props, ...overrides }));
    const loading = render({ loading: true });
    assert.match(loading, /Loading your dashboard/);
    assert.doesNotMatch(loading, /Current lead statuses/);
    assert.doesNotMatch(loading, /<strong>0<\/strong>/);
    const error = render({ error: 'Request timed out' });
    assert.match(error, /Dashboard could not load/);
    assert.match(error, /Retry dashboard/);
    const summary = {
      generatedAt: '2026-10-21T12:00:00Z', viewerId: 'admin',
      totals: { total: 10161, open: 9000, assigned: 10161, unassigned: 0, mql: 9, sql: 15, won: 76, lost: 411, connected: 4, proposal: 5, overdue: 2, dueToday: 1, pendingReview: 0, totalProjectValue: 0, upfrontValue: 0, financialRecordCount: 0, followUpsOpen: 3, followUpsCompleted: 0, overdue1To3: 1, overdue3To7: 1, overdue7Plus: 0, medianResponseHours: null, medianRoutingHours: null, actionable: 0, cleanData: 0, missingContact: 0, duplicateCandidates: 0, incorrect: 0, needsInformation: 0, slowRouting: 0, meetingsBooked: null, meetingsHeld: null },
      statusCounts: { connected: 4, lost: 411 }, qualificationCounts: {}, sourceCounts: [{ source: 'Bark Paid', count: 10161, mql: 9, sql: 15, won: 76, incorrect: 0 }], categoryCounts: [], trend: [], lossReasons: [], recentWins: [], priorities: [],
      agentPerformance: [{ userId: 'agent', name: 'Asad', role: 'sales_agent', currentAssigned: 100, worked: 200, connected: 80, proposal: 10, won: 3, lost: 18, mql: 1, sql: 3, revenue: 0, followUpCompletionRate: null, statuses: { connected: 80, won: 3, lost: 18 } }],
    };
    const ready = render({ summary });
    assert.match(ready, /10,161/);
    assert.match(ready, /Historical sales performance/);
    assert.match(ready, /Lost 18/);
    assert.match(ready, /Current lead statuses/);
    assert.match(ready, /Not available/);
    for (const page of ['Reports', 'Leaderboard', 'Benchmark Board', 'Data quality']) {
      assert.match(render({ summary, page }), new RegExp(page));
    }
    for (const role of ['sales_agent', 'marketer', 'manager']) {
      assert.doesNotMatch(render({ viewer: { ...viewer, role }, summary }), /Dashboard could not load/);
    }
    const wrongViewer = render({ summary: { ...summary, viewerId: 'another-user' } });
    assert.match(wrongViewer, /Loading your dashboard/);
    assert.doesNotMatch(wrongViewer, /10,161/);
  } finally {
    await vite.close();
  }
});
