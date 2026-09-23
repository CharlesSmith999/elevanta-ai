# Admin-only Gmail mailbox replacement

Approved by the owner: Admin may replace the connected mailbox. This extends v1.10; it does not enable intake or authorize a real mailbox change by itself.

- Only an active workspace Admin may view or invoke replacement. Enforce in API and database, not just the UI.
- The connected mailbox address, settings revision and connection controls are Admin-only. Marketing sees research records without connector configuration. Message namespaces use opaque identifiers, not email addresses; general audit records must not contain mailbox addresses or credentials.
- Show a separate confirmation form with the current/new mailbox. Stop intake immediately on confirmation, discard the CRM's old encrypted refresh token, invalidate pending authorizations and worker leases, and rotate settings revision atomically.
- Preserve every previously imported lead, assignment and activity. Namespace incoming message identifiers by mailbox after replacement to avoid collisions between accounts.
- Reject same-address changes, malformed addresses, missing setup and stale settings revisions. Concurrent administrators must reload rather than overwrite each other.
- The replacement mailbox must grant fresh Google read-only consent. Cancelled/failed consent leaves intake disabled. Reuse the existing deployment and OAuth client.
- Activation remains separate and imports only emails from the new activation timestamp. No old-inbox backfill, automatic restoration or multiple active mailboxes.
- Removing the stored token is not a claim that Google has revoked the app's grant. Explain how the mailbox owner can remove the old grant in Google account settings.
- External Testing restrictions still apply: a new mailbox needs Google test-user eligibility until production publishing/verification is complete.

Tests: non-Admin/inactive/cross-workspace denial, wrong revision, same email, invalid/null email, pending-state invalidation, lease invalidation, old-history preservation, audit record, and message namespace isolation.
