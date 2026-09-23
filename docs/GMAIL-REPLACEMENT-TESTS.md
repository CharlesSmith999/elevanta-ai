# Gmail replacement acceptance

Authority: CRM-DECISIONS-v1.11. Only Admin may see mailbox identity/settings.

Automated PASS, September 23:
- Marketing Agent, Manager and Sales Agent receive 403 on all Gmail settings operations, including replacement.
- Database validates active Admin/workspace; direct browser RPC execution denied even to Admin.
- Invalid/null/same mailbox and missing/stale revision rejected.
- Replacement atomically disables intake, clears token/cursor/lease, changes revision and removes pending OAuth states.
- Old worker can no longer persist after replacement; old callback revision no longer matches.
- Existing research records preserved. Audit records contain no mailbox address or credentials.
- Opaque message namespace avoids exposing mailbox identity through message IDs; original legacy keys remain compatible.
- 87 application tests; 23 isolated migrations; API/web typechecks.

Production PASS, September 23:
- PR46 merged as `2ce66820287f4d90e28aa8a4e8e4948c0accc407`; Vercel deployment `EeCjQmx7Y9PGhupKaUnkvUVhJhKU` reported success.
- Canonical ledger has exactly one `202609230001` entry. Authenticated browser role cannot execute the replacement RPC; service role can. Replacement audit count is zero.
- Live signed-in Admin can open the replacement confirmation form. Confirm is disabled with blank address/unconfirmed checkbox. Cancel returns without replacement.
- Marketing Agent and Marketing Manager role-preview research screens contain no Admin Gmail region or replacement controls. These are UI-preview checks, not separate authenticated user sessions; automated API denial tests cover non-admin request handling.
- No browser-console errors observed during these checks. Admin view restored afterward.

The actual production mailbox was not replaced during acceptance; destructive replacement behavior was tested only in the isolated database. No claim of Google grant revocation: only CRM token removal is implemented. Live intake remains Not connected with activation awaiting approvals; consent, activation and a fresh-message acceptance test are still outstanding. This post-release evidence is queued locally for the next grouped documentation release.
