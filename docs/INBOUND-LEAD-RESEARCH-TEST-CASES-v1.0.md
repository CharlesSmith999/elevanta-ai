# Inbound Lead Research Test Cases v1.0

## Purpose

This is the release checklist for the Gmail-to-Marketing research workflow approved in `CRM-DECISIONS-v1.8.md`. It covers safe fixtures now and the live Gmail connector after its separate activation review.

## Access and privacy

- Admin can see every research item in the workspace.
- Every active Marketing Agent can see incoming items in their workspace (v1.9).
- Every active Marketing Manager can see incoming items in their workspace (v1.9).
- Sales Manager and Sales Agent cannot see the page, API data, masked payload, or connection health.
- Masked phone and email values remain read-only source evidence and never become Sales contact methods.
- Direct API and database access enforce the same restrictions as the interface.

## Intake and idempotency

- A provider message ID creates one inbound message and one candidate per workspace.
- Reprocessing the same Gmail message does not create a duplicate candidate or opportunity.
- Missing message ID or lead name is rejected.
- Negative credits, unsupported categories, inactive owners, and owners outside the workspace are rejected.
- Parser failure keeps the source message traceable and does not publish a Sales lead.

## Research workspace

- Marketing can record a supported category, research state, notes, evidence URLs, and discovered contact methods.
- Phone requires 7 to 15 digits after formatting is removed.
- Email requires a valid email structure.
- Masked, malformed, and duplicate methods are rejected.
- Invalid evidence URLs are rejected.
- Confirmed duplicates cannot become Ready for Sales.
- Ready for Sales requires a non-empty name and at least one valid unmasked phone or email.
- Published items are immutable in the research workspace.

## Sales handoff

- Sending to Sales requires the explicit Ready for Sales state.
- The selected owner must be an active Sales Agent in the same workspace.
- Publication creates one normal opportunity with the Marketing owner, Sales owner, source, category, description, and all valid contact methods.
- Publication preserves the Gmail provider message ID as provenance.
- Repeating publication returns the existing opportunity rather than creating another one.
- Published candidates and source messages receive their final states and an audit event.
- The resulting opportunity follows the existing Sales workflow without a separate acceptance step.

## Interface and resilience

- Queue counts and filters respect the viewer's scope.
- Empty, loading, error, and no-result states are understandable.
- The workspace is usable in light and dark themes and at phone, tablet, laptop, and wide-desktop widths.
- Keyboard focus, labels, button names, error announcements, and status contrast are checked.
- Fixture mode is clearly labelled and never claims that Gmail is live.
- Failure to load or save does not silently discard the current research draft.

## Live Gmail activation gate

The Apps Script has been supplied and reviewed. The following list remains an integration acceptance checklist, not a statement that the script is still missing.

The following cases remain blocked until the current Apps Script is supplied and reviewed:

- Gmail query/label scope and least-privilege account access.
- Exact Bark email parsing against real redacted samples.
- Retry, backfill, rate-limit, and malformed-message handling.
- Secret storage, token rotation, revocation, and operational monitoring.
- End-to-end Gmail ingestion in production.

Live activation must not occur merely because fixture tests pass.

## Shared queue local verification: 2026-09-19

Connector follow-up: 78 application tests and 21 migration replays pass. Added checks verify encrypted token integrity/workspace binding, scheduler authentication, denied credential-table reads even by browser Admin, exclusive worker lease, invalid lease rejection, idempotent ingestion and unowned shared Marketing intake. Real Google OAuth, multi-page production retry and live scheduler delivery remain unverified; do not mark those cases passed.

75 application tests passed, including eight parser/reader tests. All 20 migrations replayed in isolated PostgreSQL. Shared visibility, Sales/inactive access denial, stale-save/stale-handoff rejection, legacy-write bypass prevention, idempotent handoff and publisher attribution passed. Both application typechecks and production build passed. The v1.9 migration is not yet applied to production.

## Verified release results: 2026-09-18

- PASS: 67 application tests, API/web typechecks, production build, and GitHub Actions run 309.
- PASS: all 19 migrations replayed in isolated PostgreSQL. Database checks cover scoped reads, denied Sales access, malformed/masked/duplicate methods, explicit readiness, immutable published items, Marketing Manager handoff, multiple-method preservation, and repeat-publication idempotency.
- PASS: local browser sample research, Ready save, explicit Sales handoff, and resulting Lead Inbox record.
- PASS: production migration ledger; rollback-only production handoff, two methods, and repeat publication.
- PASS: released signed-in Admin directory and empty research queue load; no browser console errors observed. API health and readiness returned success.
- NOT VERIFIED: complete phone/tablet/light/dark visual matrix, every keyboard interaction, and separate authenticated production sessions for every role. Database permission checks are not a substitute for these interface checks.
- KNOWN LIMITATION: browser-only fixture research state resets when the queue remounts. Connected records use the database and reload from it.
- BLOCKED: Gmail connector, actual parser/retry/backfill behavior, and live ingestion require the existing Apps Script, mailbox/label scope, redacted email samples, and the documented activation approvals. These are not marked passed.
