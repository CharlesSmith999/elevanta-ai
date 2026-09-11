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
