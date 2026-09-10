# Production connection recovery

Scope: restore the approved CRM workflows under CRM-PLAN.md and decisions v1.7. No product decision, database migration, or real-data import changes.

## Confirmed defects

- The live authenticated API returned HTTP 422 with an invalid Supabase URL before authentication. The Vercel SUPABASE_URL value was corrected and production rebuilt.
- Successful authentication middleware sets the profile but does not call Express next(), leaving protected requests unfinished.
- Dashboard connection errors disappear after 3.5 seconds, even while the connection is still unavailable.
- The existing health endpoint proves only that Express is running.

## Acceptance tests

1. A valid active user reaches /v1/me and the workspace directory, with a bounded response time.
2. Missing, invalid, and inactive users remain denied, and authentication service failures return an error instead of hanging.
3. Configuration readiness rejects missing or malformed Supabase configuration without returning secret values.
4. Connection failure remains visible on dashboards and offers retry without claiming a saved change.
5. On the live URL, verify connected lead loading, a clearly labelled synthetic lead save and assigned-owner visibility after reload, contact-email entry, and user-management loading.
6. Inspect password-recovery destination configuration; email receipt and completion require actual inbox evidence and must not be claimed from configuration alone.

Record actual results in PROJECT-STATUS.md. A successful build, disappearing toast, or /api/health alone cannot close this incident.
