# Elevanta AI: Sales Agent Email Sync and Outreach Plan

Status: Non-AI development scope complete locally; scheduler not enabled
Date: 2026-10-18

## Objective

Connect an individual Sales Agent mailbox to Elevanta AI so the CRM can preserve email context on the correct lead, reduce manual logging, and later support controlled outreach automation.

This is separate from the existing central Gmail intake used for Bark, Thumbtack, and Clutch lead emails.

## Non-negotiable safety boundaries

- The existing lead intake connector, lead ownership rules, incorrect-review rules, dashboards, and calling view must remain unchanged.
- Phase 1 is read-only. It must not send email, change lead status, change ownership, or create follow-ups automatically.
- Personal mailbox access must use OAuth. Passwords must never be stored.
- Only messages that can be confidently linked to a CRM lead may be imported.
- Every imported message needs a provider message ID and thread ID for idempotency.
- Agents must be able to unlink an incorrectly matched message.
- Admins can disable a mailbox and revoke its connection.

## Phased delivery

### Phase 0: Documentation and threat review

Deliverables:

- This plan.
- A decision record for the approved boundaries.
- Provider choice and OAuth scope decision.
- Data-retention and mailbox-privacy decision.

No production data or permissions change in this phase.

### Phase 1: Read-only synchronization

Deliverables:

- Additive mailbox connection records.
- Email thread and message records.
- Message-to-lead link records with confidence and match reason.
- Sync-run audit records.
- Admin-only connection setup.
- One-mailbox pilot with a small historical window.

Acceptance criteria:

- No outbound email is possible.
- The same provider message cannot be imported twice.
- Unrelated mailbox messages are ignored.
- A matched email appears in the lead timeline.
- An uncertain match enters review instead of being attached automatically.
- Disabling the mailbox stops new imports without deleting history.

The non-AI development scope is complete locally with the additive migrations `202610180004_agent_gmail_sync_foundation.sql`, `202610180006_agent_email_match_review.sql`, `202610180008_agent_email_context_suggestions.sql`, and `202610180009_agent_email_suggestion_fields.sql`, agent-only OAuth/status routes, the Sales Agent My profile form, an idempotent manual sync endpoint, a protected internal worker endpoint, a pending-match queue with safe link/ignore actions, a permission-scoped linked email context view, reviewable context suggestions, agent feedback capture, advisory status/follow-up fields, mailbox-scoped feedback statistics, and searchable lead selection. Gemini integration, production OAuth configuration, scheduling, and live migration remain separate work.

### Phase 2: Context assistance

Deliverables:

- Thread summaries.
- Intent and objection suggestions.
- Suggested status and next action.
- Suggested follow-up date.

AI output remains a recommendation. Agents confirm any CRM change.

### Phase 3: Agent-approved outreach

Stage 1 of outreach is now implemented locally. It is limited to an agent composing and explicitly sending one message from the agent's connected Gmail account. The CRM validates the lead owner, recipient, contact restrictions, send scope, and feature flag before sending. The message and result are written to the lead timeline and email audit tables. No bulk or scheduled sending is enabled.

Deliverables:

- Approved templates.
- AI-assisted drafts.
- Agent approval before sending.
- Unsubscribe, Do Not Contact, and suppression checks.
- Full send audit history.

### Phase 4: Controlled sequences

Deliverables:

- Scheduled follow-ups.
- Stop-on-reply behavior.
- Rate limits and quiet hours.
- Bounce and unsubscribe handling.
- Manager reporting.

Fully automatic sending requires a separate approval after pilot evidence.

## Proposed additive data model

The exact schema will be finalized after the provider decision. The model should contain:

- `agent_email_connections`: workspace, owner, provider, mailbox, encrypted refresh token, scopes, enabled state, last sync, and last error.
- `email_threads`: workspace, provider thread ID, subject summary, participants, and timestamps.
- `email_messages`: workspace, connection, provider message ID, thread ID, direction, sender, recipients, received/sent time, body reference, and headers.
- `email_message_links`: message, opportunity, match confidence, match reason, linked by, and unlink state.
- `email_sync_runs`: connection, start/end time, imported count, ignored count, review count, and failure code.

All tables must be workspace-scoped and protected by row-level security. Raw email content must not be exposed to users outside the permitted workspace and lead scope.

## Risk controls

| Area | Risk | Control |
|---|---|---|
| OAuth | Excessive mailbox access | Read-only scopes and admin-approved connection |
| Matching | Email attached to wrong lead | Exact address/thread matching first; uncertain matches go to review |
| Privacy | Unrelated email imported | Lead-address allowlist and sender/recipient checks |
| Duplication | Same email imported twice | Provider message ID uniqueness |
| Reliability | Provider rate limits or outages | Leased sync jobs, retries, and visible last-error state |
| Automation | Accidental outbound message | No send capability until Phase 3 |
| Compliance | Unwanted outreach | Suppression, unsubscribe, audit, and quiet-hour checks |

## Rollback strategy

- Disable the feature flag.
- Disable the affected mailbox connection.
- Stop the sync worker.
- Preserve imported messages for audit; do not delete lead history automatically.
- Revert only the new email-sync code and additive schema if a release rollback is required.

## Required decision before Phase 1 coding

The first provider is Google Workspace/Gmail using Gmail OAuth. Microsoft 365/Outlook remains a later provider.

### Stage 1 implementation boundary

- Required environment flag: `AGENT_GMAIL_SEND_ENABLED=true`.
- Agents must reconnect Gmail after the flag is enabled so Google grants `gmail.send` alongside `gmail.readonly`.
- The additive `agent_email_sends` table records pending, sent, failed, and blocked outcomes.
- Scheduled templates, reply-stop sequences, bulk delivery, AI drafting, and automatic follow-ups remain later phases.

## Agent connection form

The Sales Agent profile will show:

- Connection status: Not connected, Pending consent, Connected, Sync paused, or Error.
- Connected Gmail address after successful consent.
- Connect Gmail button.
- Sync now button after connection.
- Disconnect request button.
- Last successful sync and last error.

The form must explain that Phase 1 is read-only. The Admin settings will show every connection and provide disable/revoke controls. The agent profile must never display a password field or OAuth token.
