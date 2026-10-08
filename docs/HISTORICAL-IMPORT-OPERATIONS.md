# Historical import operations

Authority: CRM-DECISIONS-v1.16.md. No raw lead files may be committed to Git.

## Implemented boundary

Admin Review queue contains Historical import. Upload accepts a prepared `elevanta-history-v1` JSON bundle, not an arbitrary spreadsheet. API `/v1/imports/stage` validates small chunks and calls a workspace-scoped transaction. `/v1/imports/validate` seals only an exact-count batch. The original normalized row and every linked raw source copy remain in `lead_import_rows.payload`. Contact, opportunity, assignment and Gmail tables are not modified by staging.

An unchanged file can be retried after an interrupted upload. Identical rows are no-ops. Changed rows or manifest values are rejected. A batch lock serializes uploads and sealing. A unique source sheet/row prevents repeated provenance. A sealed batch cannot gain new rows.

Only active Admins in the batch workspace can read or stage data. Application roles have no direct insert/update/delete grants. Source input is treated as data, not instructions or markup. The UI does not persist uploaded payloads in browser storage.

## Release order

1. Run API/web TypeScript checks, domain tests, the frontend build, and the synthetic PostgreSQL tests.
2. Push only code, decisions and value-free operational notes. Apply source-controlled migration `202610070001` to the existing Supabase project and record it in the canonical migration ledger after verification.
3. Release through the existing Git-connected Vercel project.
4. Upload the private prepared bundle from the Admin Review queue. Verify exact saved payloads, source links, counts and RLS in production.

## Remaining activation work

`/v1/imports/commit` intentionally fails closed. Staging is not activation. Before activation implement and test:

- Explicit owner mapping and one active owner, including manager-owned historical records.
- Historical status/qualification/outcome compatibility without invented dates, amounts, reasons or activities.
- Existing-contact collision and DNC checks; review for unresolved identities and ownership.
- Transactional, retry-safe activation linked back to the exact staged row.
- Full-dataset pagination and dashboard/role reconciliation beyond the current small test dataset.
- Exact test-data identification, recoverable backup, approved cutover and post-cutover verification. Never truncate the lead tables or delete genuine Gmail records.

## Local PostgreSQL tests

Install `@electric-sql/pglite` in a disposable test directory. Set `PGLITE_MODULE` to its entry-point path and run `node scripts/test-historical-import-database.mjs`. The script builds a minimal synthetic auth/workspace fixture, applies the real staging migration and tests transactions, retry safety and permissions. It does not connect to production and is not a replacement for live RLS acceptance.
