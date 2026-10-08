# Historical import acceptance

Date: 2026-10-08. Authority: `CRM-DECISIONS-v1.16.md` and owner approval to retain the historical Incorrect records in Admin review.

## Production staging, verified

- PR #62 (`2d560386e93b564533cbd9345abdffcd8de7d257`) added the Admin-only staging workflow; PR #63 (`32bb9dd16260a14a1e9c28159d297de4b6967ded`) improved bounded, retry-safe upload chunks. Both are deployed.
- Migration `202610070001` is applied once to the existing Supabase project `jayxyikgefnzitxcbdov`. Staging row-level security is enabled; anonymous execution and direct application inserts are denied.
- The sealed private batch reconciles: 18,885 canonical records, 4,137 ready candidates, 14,748 original review records, and 36,470 preserved source links. The ordered JSONB payload fingerprint matched the private source bundle: `ce3778e4c1042d0f47397635c20befbf`.
- The original workbook checksum remained unchanged. The workbook and lead data are not in Git.
- No historical records have been activated and no existing leads have been deleted.

## Owner-approved review rule

The owner approved keeping all 527 historical records labeled `Incorrect` in Admin review. Importing them as current Incorrect would bypass the existing three-different-agent safeguard. No synthetic incorrect reports are created.

Another 29 ready candidates use unsupported status labels (`Meeting Scheduled`, `Refunded`, `No Money`, `Need Local`, `Irrelevant`). These also remain in Admin review until an explicit mapping is approved. Up to 3,581 candidates remain before live contact-collision checks; the final activation count will be lower if a method matches existing CRM data or another staged candidate.

## Activation implementation, local only

- Source-controlled migrations `202610080001` and `202610080002` add distinct `Not available` and `No Answer` statuses, historical date/status provenance, Admin-only activation outcomes, and transactional retry-safe activation.
- Owner mapping is validated against active workspace roles. The exact active Owais profile is used, not the duplicate test profile. Manager-owned legacy records remain owned by Sales Manager Ali.
- Phone/email collision checks send both rows in an unresolved identity pair to review. Existing CRM matches also go to review. Contact methods are not merged or overwritten.
- Historical dates remain separate from CRM creation dates. Won/Lost dates, revenue, loss reasons, activities, follow-ups, and stage-transition events are not fabricated.
- Opportunity list, dashboard, and coaching reads paginate beyond Supabase's default row limit. Dashboard date filters use source date for imported records.
- The observed live CRM had 15 opportunities during read-only inspection. One opportunity name was explicitly test-labeled; nothing has been deleted. Existing genuine CRM, Gmail/research records, and user accounts remain protected.

## Local verification

- 131 application tests passed; API and web TypeScript checks passed; web production build passed with the existing chunk-size warning.
- All 30 migrations replayed in an isolated PostgreSQL WASM instance. Synthetic activation checks covered safe status mapping, the Incorrect review rule, unsupported labels, existing-contact collisions, within-batch duplicates, manager-owned records, source-date preservation, no fabricated timestamps/activity, retry idempotency, and denial for Sales users.
- This local test does not substitute for production migration, role visibility, or post-activation reconciliation.

## Remaining production work

The activation implementation is not deployed or applied in production. Next: pass CI, merge and deploy through the existing GitHub/Vercel path, apply both migrations, activate safe candidates in chunks, and reconcile the activated/review totals and visibility by role. Test-lead cleanup is separate and still pending; no permanent deletion will occur without confirming the exact target at action time.
