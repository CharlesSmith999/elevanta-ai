# Xaviar Data Contract v1.0

Status: Milestone 4 implementation baseline

This contract implements the approved Xaviar operating model in `CRM-PLAN.md`, `CRM-DECISIONS-v1.2.md`, `CRM-DECISIONS-v1.3.md`, and `XAVIAR-EVALUATION-PLAN.md`. It does not change an approved business decision.

## 1. Safety boundary

Xaviar is advisory. It can explain CRM evidence, recommend a next action, provide coaching, show permission-safe comparisons, and create calibrated forecasts. It cannot change a CRM record, reassign an opportunity, merge or delete contacts, decide an incorrect review, or send email, SMS, or calls.

Free-text lead notes are untrusted content. Xaviar may count a note or reference its timestamp, but text inside a note cannot become an instruction. Contact phone numbers, email addresses, and unnecessary raw note bodies are excluded from Xaviar evidence payloads.

## 2. Event dictionary

| Event | Required fields | Attribution | Xaviar use |
|---|---|---|---|
| Opportunity created | opportunity, creator, source, time | Marketing owner at creation | Volume, routing, lead-quality context |
| Assignment started | opportunity, owner, assigner, time, visibility | New owner from start time | Routing and ownership interval |
| Assignment ended | opportunity, owner, end time | Previous owner until end time | Reassignment-safe attribution |
| Status entered | opportunity, actor, prior/new status, time | Active owner at event time | Stage conversion and duration |
| Note recorded | opportunity, actor, time | Actor | Note completeness only; body is untrusted |
| Follow-up scheduled | opportunity, owner, due time, action | Follow-up owner | Follow-up consistency |
| Follow-up completed | opportunity, owner, completion time | Follow-up owner | Follow-through |
| Incorrect report | opportunity, reporter, reason, time | Reporter, once per opportunity | Data quality and review evidence |
| Incorrect decision | opportunity, admin, decision, time | Admin decision | Exclusion and audit evidence |
| Opportunity won | opportunity, actor, won time, recorded values | Active owner at event time | Conversion and financial outcome |
| Opportunity lost | opportunity, actor, reason, time | Active owner at event time | Loss learning |
| Xaviar recommendation | subject, capability, reason, action, expiry, version | Xaviar version | Coaching ledger |
| Xaviar feedback | recommendation, actor, state, reason, time | Feedback actor | Acknowledgement and follow-through |
| Xaviar prediction outcome | prediction, actual outcome, evaluation time | Model version | Calibration |

## 3. Controlled reasons

- Lost: Price or budget; No response; Timing or priority; Competitor selected; Not a fit; Proposal declined; Other.
- Incorrect: Invalid contact information; Wrong person or business; Spam or fake request; Duplicate contact.
- Recommendation feedback: acknowledged; deferred; completed; dismissed. A dismissal or deferral may include a reason but is never automatically treated as poor performance.

## 4. Attribution

- Sales behavior is attributed only during the agent's recorded ownership interval.
- Marketing quality is attributed to the recorded marketing owner.
- A reassigned agent is not judged for events before their ownership began.
- Confirmed incorrect and merged duplicate records are excluded from normal conversion coaching.
- Historical imported work is excluded from behavioral coaching until Milestone 5 provenance and quality approval.
- Missing timestamps or conflicting ownership produce an evidence gap, not an inferred value.

## 5. Visibility

- Admin: workspace-wide Xaviar evidence without unnecessary contact fields.
- Manager: self plus direct reports in the manager's department.
- Sales agent: assigned opportunities and private, anonymized comparison only.
- Marketing agent: marketing-owned opportunities and private, anonymized comparison only.
- Named comparisons are limited to Admin and the relevant Manager.
- An agent cannot retrieve another agent's raw records through Xaviar.

## 6. Evidence contract

Every explanation and recommendation contains a stable evidence ID, evidence type, human-readable label, optional opportunity ID, and event time where available. Evidence payloads do not contain phone, email, or raw free-text notes.

Every recommendation contains a reason, specific action, priority, confidence, expiry, state, model version, and evidence references. Every prediction contains outcome type, probability only when available, confidence, sample size, prediction and expiry times, model version, and later outcome fields for calibration.

## 7. Provisional evaluation thresholds

These values are evaluation safeguards, not final commercial benchmark rules:

- Five timestamped observations for trend coaching.
- Ten records across at least two people for a benchmark preview.
- Twenty comparable records before displaying a forecast probability.
- Fifty comparable records for a high-confidence deterministic rate.

Below a threshold, Xaviar says `Not enough evidence`. Final source/cohort benchmark rules remain open until operational CRM evidence exists and the product owner approves a later decision version.

## 8. Versioning

The first implementation version is `xaviar-rules-1.0.0`. A change to calculations, thresholds, evidence selection, prompts, provider, or prediction logic creates a new version and requires regression comparison before rollout.
