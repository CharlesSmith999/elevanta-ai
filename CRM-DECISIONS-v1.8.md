# Elevanta AI — Inbound Lead Research Decisions v1.8

Status: Approved by product owner on 2026-09-17

This version extends [CRM-DECISIONS-v1.7.md](./CRM-DECISIONS-v1.7.md). It governs inbound masked leads received through Gmail, the Marketing-only research workflow, and the controlled handoff into the existing Sales lead workflow. All non-conflicting earlier decisions remain valid.

| Decision | Approved rule |
|---|---|
| Separate intake | Gmail-sourced masked leads enter a `Lead Research Queue`; they do not enter the normal Lead Inbox or become Sales assignments automatically. |
| Visibility | Marketing Agents see their own research items, Marketing Managers see their team, and Admin sees the workspace. Sales roles cannot read research-queue records or masked contact details. |
| Research purpose | Marketing researches the web to replace masked contact details with usable phone numbers, email addresses, links, and evidence notes. |
| Research states | The controlled states are `New`, `Researching`, `Found`, `Not Found`, `Connected`, `Ready for Sales`, `Sent to Sales`, and `Rejected`. `Found`, `Not Found`, and `Connected` are research outcomes and never replace the CRM opportunity lifecycle. |
| Sales readiness | A research item may become `Ready for Sales` only when it has a name plus at least one usable, unmasked, valid phone number or email address. |
| Handoff | Marketing selects an active Sales Agent and explicitly chooses `Send to Sales`. Handoff creates or links the canonical Contact, creates one Opportunity, records provenance, and activates the normal immediate-assignment workflow. |
| Duplicate safety | Gmail provider message ID is the ingestion idempotency key. Normalized email, phone, provider lead ID, and message/thread references are checked before publication. Duplicate candidates are reviewed; records are never silently merged. |
| Source of truth | The CRM becomes the operational source of truth after publication. The Google Sheet remains a temporary parallel audit source during validation and may later become export-only. |
| Safe delivery | Build and automated testing use synthetic email fixtures. Live Gmail activation remains disabled until the current Apps Script is reviewed and the existing Xaviar Admin/Manager approvals are recorded. |
| Gmail permissions | The production connector uses a dedicated mailbox or label and the minimum read-only Gmail scope. Tokens remain server-side and encrypted. No email sending is included. |
| Xaviar boundary | Xaviar may analyze structured research outcomes and downstream quality after release. It cannot browse the web, change research state, publish a lead, assign Sales, or follow instructions embedded in email content. |

## Required interface behavior

1. Marketing navigation includes `Lead Research`; Sales navigation does not.
2. The queue shows received time, source, masked identity, category, state, completeness, duplicate warning, owner, and the next permitted action.
3. The research workspace preserves the original masked payload and offers structured fields for discovered contact methods, evidence links, and notes.
4. `Send to Sales` remains unavailable until the readiness rule passes and an active Sales Agent is selected.
5. Publication is atomic and idempotent. Retrying the same handoff returns the already-created Opportunity instead of creating another.
6. Admin receives connection health, parser failures, retry state, and an audit history. Normal users never see OAuth credentials or raw connector errors.

## Rollout boundary

This is an inbound acquisition workflow, not Phase 2 outbound automation. Development may proceed with safe fixtures before Milestone 5. Reading live Gmail and creating live research records remain an activation gate and do not authorize outbound email, SMS, calls, or automated Sales assignment.

## Implementation reference

The detailed screen, schema, API, security, and test contract remains [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md), extended by this decision.
