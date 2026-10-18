# CRM Decisions v1.25: performance and list visibility

Date: 2026-10-18
Status: Approved by the request to implement the agreed performance improvements

## Scope

- The download button is hidden from every CRM view.
- Lead inbox rows are paginated at 50 rows per page. Filters and sorting still apply before pagination, so counts remain accurate and the current assignment-first ordering is preserved.
- The opportunities API supports optional bounded pages using `limit` and `offset`, while the existing unpaged contract remains available for dashboard compatibility.
- Additive database indexes support workspace ordering, current assignment ordering, source filtering, and open follow-up queues.

## Safety boundary

This release does not change lead data, ownership, permissions, statuses, calling behavior, or dashboard definitions. It changes only how records are read and displayed. The index migration is additive and safe to roll back by dropping the named indexes if required.

## Follow-on performance work

The next performance milestone should move dashboards to summary endpoints, lazy-load chart/history data, and use server-side filter parameters for the inbox so the browser does not download the complete lead history for every screen.
