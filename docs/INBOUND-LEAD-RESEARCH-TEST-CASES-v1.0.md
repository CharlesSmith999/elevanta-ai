# Inbound Lead Research Test Cases v1.0

## Purpose

This is the release checklist for the Gmail-to-Marketing research workflow approved in `CRM-DECISIONS-v1.8.md`. It covers safe fixtures now and the live Gmail connector after its separate activation review.

## Access and privacy

- Admin can see every research item in the workspace.
- A Marketing Agent can see only items assigned to that agent.
- A Marketing Manager can see only items owned by agents reporting to that manager.
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

The following cases remain blocked until the current Apps Script is supplied and reviewed:

- Gmail query/label scope and least-privilege account access.
- Exact Bark email parsing against real redacted samples.
- Retry, backfill, rate-limit, and malformed-message handling.
- Secret storage, token rotation, revocation, and operational monitoring.
- End-to-end Gmail ingestion in production.

Live activation must not occur merely because fixture tests pass.
