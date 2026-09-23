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

Production pending: migration ledger, deployment, Admin confirmation form/cancel, Marketing view without settings. Do not replace the owner's real mailbox during acceptance. No claim of Google grant revocation: only CRM token removal is implemented.
