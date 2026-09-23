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

### One-minute implementation work (2026-09-22)

Use the existing Supabase Cron and pg_net extensions to invoke the fixed production worker URL every minute. Read the Bearer secret from Vault at execution, never embed its value in job SQL. The database function is restricted to the database administrator, skips HTTP while intake is disabled, and records request IDs for checking HTTP results separately from cron success. Remove the old Vercel daily job in the same release. No release gate is relaxed.

Research-list refresh runs every minute only while the list is open. Opening a record cancels delivery of pending refresh results; no background reload can replace an unsaved draft. Returning to the list reloads current records. Test initial load, overlap, failures, cleanup and delayed results before release.

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

September 23 activation authority: [Decisions v1.12](../CRM-DECISIONS-v1.12.md) removes the Xaviar sign-off dependency for Gmail only. Owner consent is confirmed by the live Connected status. Enable the production release setting and perform explicit Admin activation for new messages only; scheduled Google access and actual message ingestion must each be verified, not inferred from authorization.

Latest verified release: PR45 is deployed as production commit `5932b6af617828b437b2f16854e8dd9bf5be12a7`. Minute scheduler and draft-safe refresh are deployed; server credentials are effective. Google sole test-user entry and gmail.readonly scope are saved. Consecutive scheduler runs and a credential-authenticated HTTP200 idle response are verified. Consent by the mailbox owner, live activation and real-message acceptance are still pending. External Testing refresh tokens expire in seven days; durable production OAuth readiness must be addressed separately. See [GMAIL-MINUTE-ACCEPTANCE.md](./GMAIL-MINUTE-ACCEPTANCE.md). This supersedes the earlier pending implementation/configuration statements retained below.

Latest instruction: connect the privately designated Gmail mailbox and check every minute, under [Decisions v1.10](../CRM-DECISIONS-v1.10.md). One-minute scheduling and draft-safe list refresh are pending, not deployed. The Vercel dashboard confirms the existing team is Hobby; an approved supported scheduler is needed rather than deploying an invalid minute-level Vercel cron. Google authorization is now requested by the owner but not yet granted.

Setup verification (2026-09-22): the owner-designated address is saved in the production Admin form. The earlier Google 2-step-verification blocker is resolved. The OAuth client is created and server credentials are saved as detailed below. Supabase Vault is already installed and the scheduler credential is stored there. Supabase Cron remains to be configured and tested in the existing project. Reference: https://supabase.com/docs/guides/cron . No paid upgrade or new hosting instance was created.

Owner update: provide an Admin form to save the mailbox later without Google authorization or OAuth server configuration. Saving is not connecting or activating. The saved address is workspace-scoped and validated server-side. Once connected, changing the mailbox is blocked to prevent silently replacing credentials. OAuth callbacks must match the saved mailbox and settings revision. Release may proceed with intake disabled; live Google acceptance is deferred by the owner.

The implementation and Admin form were deployed through PR #44 on 2026-09-21, production commit `bad78de7c405611af3a5d016bd6d4a522c6797fb`. Both production migrations are confirmed. The form was initially blank; the owner-designated address has since been saved. A rollback-only production persistence test passed. Gmail remains disconnected and intake disabled. Live OAuth consent and real-message acceptance are outstanding. Mailbox identity must not be hardcoded in public source.

## Server implementation contract

Google setup progress (2026-09-22): security access is restored. Created the single integration project `canvas-hybrid-509321-m7` (Elevanta AI Gmail Intake) and verified Gmail API is Enabled. With explicit owner permission, the Google User Data Policy was accepted and the Elevanta AI consent application was created, with the existing Cloud administrator as support/developer contact and External testing audience. After exact owner approval for credential creation and storage, created one Web application client named Elevanta AI Production Gmail with only `https://elevanta-ai-pipeline.vercel.app/api/v1/inbound/gmail/callback` as its redirect. Creation was confirmed by Google's success dialog.

Credential storage verified on 2026-09-22:

- Existing Vercel project, Production only, Secret type: `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_TOKEN_KEY`, `CRON_SECRET`. Encryption key generated with cryptographically secure 32-byte randomness; independent scheduler secret generated with 48-byte randomness.
- Existing Supabase project Vault: `elevanta_gmail_cron_secret`, matching Vercel `CRON_SECRET`. Supabase confirmed successful save. No OAuth client secret or encryption key duplicated into ordinary database tables.
- Values were not printed in chat, written to source files, or committed. No existing credentials were replaced. No new Supabase/Vercel project or paid service was created.
- Vercel states a new deployment is needed for environment changes to take effect. Deployment of this configuration is not yet verified. `GMAIL_LIVE_APPROVED` was not enabled.
- Still outstanding: Google test-user/scope setup, mailbox-owner consent, minute scheduler, draft-safe queue refresh and live-message acceptance. Credential creation is not mailbox connection or activation.

- Gmail connection operations require an authenticated active workspace Admin. OAuth uses PKCE, a ten-minute single-use state, and an HttpOnly same-site browser cookie. Callback validates the configured mailbox.
- Refresh tokens use AES-256-GCM encryption with workspace-bound authenticated data and a server-only 32-byte key. No token is returned to the browser or included in health responses.
- Privileged connector access is restricted to dedicated connection/state tables and ingestion/lease RPCs. Existing normal lead requests continue using the caller's permissions.
- Scheduler authenticates with a separate secret. One workspace lease serializes scans; each persisted outcome is idempotent. The page cursor advances only after every message in that page has a durable outcome. Failed scans retain the cursor.
- Connecting is not activation. Explicit activation requires the server release gate; it starts a new-email-only timestamp. Disable invalidates the worker lease immediately.
- Required connection configuration: GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, GMAIL_TOKEN_KEY, CRON_SECRET, GMAIL_LIVE_APPROVED. Values must remain outside Git. The mailbox is entered through the Admin form and stored per workspace, not in an environment variable. Saving the address needs only the existing CRM database configuration. Callback is the existing site's /api/v1/inbound/gmail/callback.
- Schedule defaults to daily on the existing Vercel project to avoid assuming paid-plan minute scheduling. Manual Admin sync is also available. Faster scheduling requires a supported hosting plan and a separate approved configuration change.
