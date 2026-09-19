# Direct Gmail intake implementation

Authority: [Decisions v1.8](../CRM-DECISIONS-v1.8.md). The owner approved direct Gmail intake and new messages only. The supplied Apps Script has been reviewed. This document does not remove the existing release-approval gates.

## Approved behavior

- Gmail directly to the Marketing research queue, never via Google Sheets.
- New messages received at or after the explicit activation timestamp only. No historical backfill.
- Bark sender domain; Inbox and Spam; App, Web and SMM categories.
- Ignore `BarkProcessed` when reading. Do not write labels, mark mail read, send mail, or change the existing Sheet script.
- Preserve masked methods as evidence, not usable Sales contacts. Preserve multiline names and description. Read email content as data, never instructions.
- Idempotency by individual Gmail message ID. Persist ingestion outcomes before advancing a page cursor. Failed parsing remains reviewable, not silently dropped.
- Shared queue approved in [v1.9](../CRM-DECISIONS-v1.9.md). No claim step. Any marketer can research and send; the publishing marketer becomes the normal CRM marketing owner. Intake may be unowned until a marketer contributes. Revision checks prevent lost edits.

## Delivery sequence and acceptance

1. Implement a bounded parser and read-only Gmail message reader with synthetic tests.
2. Configure the existing project's Google OAuth client, exact callback URL and server-side encrypted credential storage. Consent must be granted by the mailbox owner. An email address alone is not authorization.
3. Add connection state, activation time, durable polling lease/cursor, per-message retry/review records, and scoped transactional persistence. Do not use broad service-role access in ordinary CRM requests.
4. Add Admin connect/disable/health controls and a scheduled worker in the existing deployment. Confirm scheduler frequency supported by the current hosting plan before promising near-real-time sync.
5. Verify redacted actual email samples, permission boundaries, consent revocation, token expiry, pagination, retries, and end-to-end delivery. Only then enable new-email intake after the documented approvals.

## Script issues to avoid

The old script labels threads rather than individual messages, lacks a message-ID ledger, extracts only a single alphabetic name token, and uses permissive phone matching. Its monthly sheet follows processing month rather than email date. CRM ingestion must not inherit these behaviors.

## External references

- [Gmail message listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)
- [Server-side authorization](https://developers.google.com/workspace/gmail/api/auth/web-server)

## Current status

Owner update: provide an Admin form to save the mailbox later without Google authorization or OAuth server configuration. Saving is not connecting or activating. The saved address is workspace-scoped and validated server-side. Once connected, changing the mailbox is blocked to prevent silently replacing credentials. OAuth callbacks must match the saved mailbox and settings revision. Release may proceed with intake disabled; live Google acceptance is deferred by the owner.

Parser/reader, OAuth/PKCE callback, encrypted token storage, worker leases/cursor, idempotent persistence, scheduler and Admin controls are implemented locally. They are not deployed or connected. Mailbox identity is supplied privately by the owner and must not be hardcoded in public source. Google Cloud was inspected and blocks setup until the signed-in account enables 2-step verification. Live OAuth consent, configuration, production migration and real-message acceptance remain pending.

## Server implementation contract

- Gmail connection operations require an authenticated active workspace Admin. OAuth uses PKCE, a ten-minute single-use state, and an HttpOnly same-site browser cookie. Callback validates the configured mailbox.
- Refresh tokens use AES-256-GCM encryption with workspace-bound authenticated data and a server-only 32-byte key. No token is returned to the browser or included in health responses.
- Privileged connector access is restricted to dedicated connection/state tables and ingestion/lease RPCs. Existing normal lead requests continue using the caller's permissions.
- Scheduler authenticates with a separate secret. One workspace lease serializes scans; each persisted outcome is idempotent. The page cursor advances only after every message in that page has a durable outcome. Failed scans retain the cursor.
- Connecting is not activation. Explicit activation requires the server release gate; it starts a new-email-only timestamp. Disable invalidates the worker lease immediately.
- Required connection configuration: GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_TOKEN_KEY, CRON_SECRET, GMAIL_LIVE_APPROVED. Values must remain outside Git. The mailbox is entered through the Admin form and stored per workspace, not in an environment variable. Saving the address needs only the existing CRM database configuration. Callback is the existing site's /api/v1/inbound/gmail/callback.
- Schedule defaults to daily on the existing Vercel project to avoid assuming paid-plan minute scheduling. Manual Admin sync is also available. Faster scheduling requires a supported hosting plan and a separate approved configuration change.
