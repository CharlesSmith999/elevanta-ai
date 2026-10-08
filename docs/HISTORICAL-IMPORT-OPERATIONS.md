# Historical import operations

Authority: CRM-DECISIONS-v1.16.md. No raw lead files may be committed to Git.

## Implemented boundary

Admin Review queue contains Historical import. Upload accepts a prepared `elevanta-history-v1` JSON bundle, not an arbitrary spreadsheet. API `/v1/imports/stage` validates small chunks and calls a workspace-scoped transaction. `/v1/imports/validate` seals only an exact-count batch. The original normalized row and every linked raw source copy remain in `lead_import_rows.payload`.

An unchanged file can be retried after an interrupted upload. Identical rows are no-ops. Changed rows or manifest values are rejected. A batch lock serializes uploads and sealing. A unique source sheet/row prevents repeated provenance. A sealed batch cannot gain new rows.

Only active Admins in the batch workspace can read, stage, inspect, or activate data. Application roles have no direct insert/update/delete grants. Source input is treated as data, not instructions or markup. The UI does not persist uploaded payloads in browser storage.

Activation is separately Admin-triggered, chunked, and retry-safe. Exact owner mappings are validated against active workspace profiles; one owner is created for each opportunity, including approved Manager-owned historical records. The Marketing owner and Sales owner remain separate. Acquisition source is set to `Other` when the workbook does not identify a channel; the marketer name is not misrepresented as an acquisition channel.

The original status and source date basis remain linked to the immutable staged record. `Not available` and `No Answer` remain distinct CRM statuses. Historical `Incorrect` records are routed to Admin review, not made current Incorrect and not converted into fabricated three-agent reports. Unsupported statuses, conflicting qualification, duplicate contact methods, and matches to existing CRM contacts remain in review. No historical calls, notes-as-activities, follow-ups, Won/Lost timestamps, revenue, or loss reasons are fabricated. Historical source dates are stored independently of CRM creation dates; imported rows do not receive invented stage-history events.

## Release order

1. Run API/web TypeScript checks, domain tests, the frontend build, and the synthetic PostgreSQL tests, including the historical activation cases.
2. Push only code and value-free operational notes. Compare all changes against `CRM-DECISIONS-v1.16.md`. Apply source-controlled migrations `202610080001` and `202610080002` to the existing Supabase project only after CI and the production release are verified. Record applied versions in the canonical migration ledger.
3. Release through the existing Git-connected Vercel project and verify Admin-only activation access and historical-date dashboard filters.
4. Verify the existing staged batch by exact row count, source links, and payload fingerprint. Activate safe candidates in retry-safe chunks. Reconcile activated, review, and remaining counts after every chunk.
5. Preserve all pre-existing live CRM and Gmail/research data. Do not delete any current opportunity without first identifying the exact disposable records, keeping a recoverable backup, and confirming the permanent deletion immediately before it.

## Remaining activation work

Historical activation is implemented locally, but remains disabled in production until release and both source-controlled migrations have been applied. The owner approved routing 527 historical `Incorrect` records to Admin review. The source also contains unsupported historical labels; these stay in review until explicitly mapped. The live staging batch currently remains staged and must not be represented as activated until the production reconciliation confirms it.

Exact test-data retirement is a separate pending action. Never truncate lead tables, delete genuine Gmail/research records, or remove staff profiles as part of lead cleanup.

## Local PostgreSQL tests

Install `@electric-sql/pglite` in a disposable test directory. Set `PGLITE_MODULE` to its entry-point path and run `node scripts/test-historical-import-database.mjs` for staging behavior or `node scripts/test-inbound-database.mjs` for the full migration sequence and historical activation cases. These scripts use synthetic fixtures and do not connect to production; they are not a replacement for live RLS acceptance.
