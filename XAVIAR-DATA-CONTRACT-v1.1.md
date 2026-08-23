# Xaviar Data Contract v1.1 — Lead Workflow Delta
Status: Approved specification; implementation and evaluation pending

This version extends [XAVIAR-DATA-CONTRACT-v1.0.md](./XAVIAR-DATA-CONTRACT-v1.0.md) and implements [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md). It does not authorize autonomous CRM mutations.

## 1. Removed concept

Manual `Sales Acceptance` is removed from Xaviar evidence, explanations, recommendations, coaching, benchmarks, and predictions.

Use distinct derived evidence instead:

- `First Worked At`: first eligible Sales activity in an ownership interval;
- `Connected At`: first Connected outcome in that interval;
- `SQL Entered At`: first SQL transition in that interval;
- `Sales Engaged At`: earliest Connected At or SQL Entered At.

Xaviar must state whether Sales Engagement came from Connected or SQL. A failed attempt may prove first work but never proves engagement.

## 2. Added event dictionary

| Event | Required fields | Attribution | Xaviar use |
|---|---|---|---|
| Contact method added | opportunity, method ID/type, creator, time | Actor; supplied quality also to Marketing owner | Completeness and quality context |
| Contact method updated | method, actor, before/after metadata, time | Actor | Data-hygiene evidence |
| Contact method assessed | method, assignment, actor, health/focus, reason, time | Current owner at event time | Contact quality and Sales working evidence |
| Removed from active focus | method, assignment, actor, reason, time | Sales actor; supplied-quality context to Marketing owner | Incorrect/wrong-person pattern |
| Moved to secondary | method, actor, Reception/Gatekeeper reason, time | Actor | Prioritization context |
| Contact method restored | method, restorer, prior state, reason, assignment, time | Restoring role; later result kept separate | Restoration effectiveness |
| DNC applied | method, actor, reason, time | Compliance event, not performance score | Outreach restriction and audit |
| Reassignment contact decision | old/new assignment, method, keep/restore decision, actor, time | Assigner | Handoff quality and safety |
| Sales activity logged | assignment, activity type, outcome, method ID, actor, time | Active Sales owner | Execution and follow-up evidence |
| Sales first worked | assignment, source activity, time | Active Sales owner | Response/working-speed evidence |
| Sales connected | assignment, source activity, time | Active Sales owner | Connection evidence |
| SQL entered | assignment, actor, time | Active Sales owner | Qualification evidence |
| Sales engaged | assignment, source event type/ID, time | Active Sales owner | Derived engagement evidence |

## 3. Reasoning rules

- Contact health and activity outcome are different dimensions.
- No Answer, Busy, and Voicemail do not make a method incorrect.
- Incorrect and Wrong Person removal is reversible by approved roles; removal is never deletion.
- Reception/Gatekeeper remains secondary and may still support a later connection.
- DNC is a compliance restriction and cannot be treated as poor Sales or Marketing performance without context.
- Contact-method removal alone is not an opportunity-level incorrect report.
- Three-agent threshold evidence uses explicit opportunity-level reports only.
- Fresh-start visibility never erases suppression, DNC, duplicate, or review evidence.
- Restoration success requires a later Connected or Replied outcome and sufficient observation time.
- Marketing quality and Sales execution are reported separately before any combined explanation.

## 4. Role-specific coaching additions

### Sales Agent

- Prioritize active verified methods before unverified or secondary methods.
- Remind the agent about unworked assignments and overdue follow-ups.
- Coach on outcome logging, follow-up consistency, SQL timing, and repeated unsuccessful attempts.
- Never recommend outreach to a removed or DNC method.

### Marketing Agent

- Explain actionable-contact yield, removal reasons, wrong-person patterns, restoration outcomes, and time to first Sales work.
- Identify sources or creation habits producing repeated unusable methods.
- Never blame Marketing for Sales delays after a valid, actionable handoff.

### Managers

- Separate source/contact-quality problems from Sales execution problems.
- Surface unusual removal rates, repeated restoration reversals, assigned-but-unworked leads, and follow-up failures inside the manager's scope.

### Admin

- Show workspace-wide policy, data-quality, DNC, restoration, three-agent review, and event-completeness risks.

## 5. Evidence privacy and safety

- Evidence payloads use stable contact-method IDs and types, not raw phone numbers or emails.
- Raw note bodies remain untrusted and excluded unless a later approved redaction contract exists.
- Xaviar cannot restore, suppress, reassign, merge, delete, mark DNC, set MQL/SQL, or create an activity/follow-up in Phase 1.
- Contact and activity evidence follows the same workspace, ownership, marketing-owner, and manager-scope RLS as the CRM.
- Historical imported events remain excluded from personal behavior coaching until Milestone 5 provenance approval.

## 6. Version and release gate

Planned version: `xaviar-rules-1.1.0`.

Release requires the schema/API workflow, event-stream extension, deterministic metric reconciliation, role-permission tests, prompt-injection tests, privacy checks, small-sample suppression, Admin review, and Manager review to pass. The existing v1.0 implementation remains active until v1.1 is developed and approved.
