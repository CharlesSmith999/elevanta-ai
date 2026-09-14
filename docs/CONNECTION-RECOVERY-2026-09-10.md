# Production connection recovery

Scope: restore the approved CRM workflows under CRM-PLAN.md and decisions v1.7. No product decision or real-data import changes. An additive repair migration corrects the existing lead-creation routine without changing the approved workflow.

## Confirmed defects

- The live authenticated API returned HTTP 422 with an invalid Supabase URL before authentication. The Vercel SUPABASE_URL value was corrected and production rebuilt.
- Successful authentication middleware sets the profile but does not call Express next(), leaving protected requests unfinished.
- Dashboard connection errors disappear after 3.5 seconds, even while the connection is still unavailable.
- The existing health endpoint proves only that Express is running.
- Production nested API routes returned Vercel NOT_FOUND before reaching Express. Explicit wildcard routing now targets one server function.
- A rollback-only production database test reproduced SQLSTATE 42804: the v1.7 creation routine supplied text instead of the opportunity_status enum. Migration 202609110001 fixes the CASE expression and preserves the deployed routine's other behavior.
- The lead form showed save failures outside the modal and reset a React event target after an asynchronous wait. Errors now stay inside the form, saving disables repeated submission, and a successful save followed by failed refresh is not misreported as an unsaved lead.

## Acceptance tests

1. A valid active user reaches /v1/me and the workspace directory, with a bounded response time.
2. Missing, invalid, and inactive users remain denied, and authentication service failures return an error instead of hanging.
3. Configuration readiness rejects missing or malformed Supabase configuration without returning secret values.
4. Connection failure remains visible on dashboards and offers retry without claiming a saved change.
5. On the live URL, verify connected lead loading, a clearly labelled synthetic lead save and assigned-owner visibility after reload, contact-email entry, and user-management loading.
6. Inspect password-recovery destination configuration; email receipt and completion require actual inbox evidence and must not be claimed from configuration alone.
7. Verify nested user-management, contact-method, and activity routes reach the API, while invalid authentication remains denied.
8. Test assigned and unassigned creation, assignment visibility, category/description preservation, invalid identity, and invalid owner inside rollback-only database tests. Verify the migration is idempotent.

Record actual results in PROJECT-STATUS.md. A successful build, disappearing toast, or /api/health alone cannot close this incident.

## Verified release and remaining acceptance

September 14 diagnosis: direct privilege checks confirm that service_role has public schema usage but no SELECT/INSERT/UPDATE on profiles and no INSERT on audit_events. This explains the Admin database failure despite a configured server key. Prepared migration 202609140001 grants only the operations used by Admin user-management, including assignment reads for the active-lead deactivation guard. Production application requires the user's at-action permission approval. It grants nothing to anon/authenticated and does not disable RLS. Verify Admin loading and a reversible edit after applying; do not treat the diagnosis as a completed repair.

Additional September 14 contact checks: a fresh live lead saved successfully with category, description, and Sales assignment. Adding another email reproduced SQLSTATE 42804 on the contact_method_health CASE expression. Migration 202609140002 fixes health/focus enum casts in both the contact link and audit-event inserts. The contact-method API also embedded contact_method_events as a direct relationship that does not exist in the deployed foreign keys. Remove that unused embed; the event records remain untouched. Expand the rollback test to cover both added email and phone links and their audit events.

PRs #39 and #40 are merged. Production source e6c726092ce2923ad257cc59e3aa0f53ad9cb5a1 is deployed, including the routing and lead-form repair. Migration 202609110001 is applied and recorded; its rollback-only creation/assignment/RLS tests passed and a follow-up count confirmed zero retained rollback-test records. A labelled live synthetic lead also persisted with its Sales assignment and appeared after a fresh page load.

The server-only Admin key was missing and was added securely to Production, then redeployed. Admin user management still returns a generic server error. Do not infer that adding the key completed the repair. The remaining diagnostic is to inspect database privileges and the exact Admin endpoint failure without exposing secrets.

Browser usage was blocked by the account limit before fresh-build submission, contact-email addition, Sales UI, Admin management, and password-recovery completion could be verified. These are explicit open checks, not passes. No real lead workbook or credentials were published.
