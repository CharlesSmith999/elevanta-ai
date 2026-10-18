# CRM Decisions v1.26: progressive loading and dashboard summaries

Date: 2026-10-18
Status: Implemented and ready for release

## Performance changes

- The CRM requests the first 50 leads first, so users see the inbox before the complete history finishes loading.
- The complete lead set still loads in the background so existing dashboard totals and permissions remain accurate.
- A lightweight dashboard summary endpoint returns status and qualification counts using database count queries instead of returning every opportunity row. It is available for the next dashboard client cutover.
- Pipeline, role, and Admin charts wait until the browser is idle before calculating and rendering. The business data and chart definitions are unchanged.

## Safety boundary

No lead, assignment, status, permission, calling, or reporting rule changed. The first-page response is only a loading optimization. The full dataset remains the source for current dashboard calculations until the summary endpoint is adopted by the dashboard client.

## Next optimization

The large JavaScript bundle should be split by dashboard route with dynamic imports after a production browser measurement confirms the largest loading path.
