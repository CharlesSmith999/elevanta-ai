# Elevanta AI — Xaviar Build and Rollout Decisions v1.3

Status: Approved by product owner

This decision record extends `CRM-DECISIONS-v1.2.md` and the baseline in `CRM-PLAN.md`.

## Operational rollout

- Milestones 2–4 use synthetic or safe sample data for development and validation.
- Sales agents and marketers begin using the CRM for live work only after Milestone 5 completes the approved Excel migration, validation, and activation gate.
- After activation, newly recorded CRM work is Xaviar’s primary source for personalized coaching.
- Historical Excel data is labeled as imported history and is used only when provenance and quality support the requested metric.

## Milestone 4 delivery gates

| Sub-phase | Output | Release condition |
|---|---|---|
| 4A — Data contract | Event dictionary, reason lists, attribution, evidence, visibility, and sample-size rules | Product and technical rules documented |
| 4B — Data foundation | Event/query layer, snapshots, recommendation ledger, feedback, audit/version fields | Events and evidence are queryable and permission-safe |
| 4C — Explain | Trend summaries and lead-stage explanations | Every explanation cites evidence and marks missing data |
| 4D — Recommend | Priorities, next actions, follow-up and quality guidance | Recommendations include confidence, expiry, and reason |
| 4E — Coach/benchmark | Role coaching, safe skill benchmarks, manager plans, follow-through | Small samples are suppressed and privacy tests pass |
| 4F — Predict/calibrate | Forecasts with confidence and outcome tracking | Held-out sample tests and calibration pass |
| 4G — Integrate | Xaviar inside each role dashboard | Role-specific visibility and safe empty states pass |
| 4H — Safety/release | Edge-case, bias, security, and human-review evaluation | Admin/manager sign-off before Milestone 5 |

## Activation gate

No live agent or marketer rollout occurs until imported records have provenance, duplicate decisions, permission validation, dashboard reconciliation, and admin approval. Xaviar must remain advisory until the separate Phase 2 follow-through and communication controls are approved.
