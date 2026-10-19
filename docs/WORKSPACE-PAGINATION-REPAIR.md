# Workspace loading repair

October 19, 2026. Implementation candidate; production acceptance is separate.

The workspace reader previously traversed the complete opportunity collection and complete history tables before returning one response. A limit-only workaround would silently truncate CRM and research results. The corrected client follows immutable-ID cursors until every permitted record has loaded. The API returns at most 250 opportunities per request; related history queries are restricted to batches of at most 100 opportunity IDs, with all history pages retained. This also keeps UUID filters below common gateway URL limits. Research and individual activity-history views use cursor pages too.

Authenticated startup does not show browser demo/cache records or incomplete dashboard totals. It reports loading progress, publishes the complete result only after the directory and leads succeed, and offers retry after failure. Each read has a 25-second client deadline; stale startup requests are cancelled. Missing or repeated cursors fail explicitly instead of silently accepting partial results. Persisted Won financial fields are included in the existing lead mapping.

No database migrations, production-data writes, access-policy changes, or mailbox changes are part of this repair. Every database query still uses the authenticated caller's Supabase client and existing row-level security.

Validation completed locally:

- API TypeScript production build and web TypeScript/production build passed.
- Twelve targeted tests passed. Synthetic fixtures cover 10,161 opportunities, 1,001 history rows, 501-row CRM/research/activity routes, relation scope, cursor validation, empty and exact-multiple pages, failed later pages, timeout, and cancellation.
- All 129 socket-free application tests passed. Five existing socket-based test files were not rerun because the environment could not approve a local listening server; this is not a claim that the full suite ran.
- The new route tests invoke the real authentication and route handlers in process. They do not claim an authenticated production HTTP test. A listening-socket test run was not available in the restricted environment.
- The web build retains its existing large-bundle warning.

Required release acceptance: verify a signed-in Admin reaches a complete workspace; reconcile displayed all-time opportunity and research totals with a contemporaneous read-only database count; open old and new leads and inspect history; inspect loading errors and page response times. Health checks and unauthenticated responses do not satisfy this acceptance.
