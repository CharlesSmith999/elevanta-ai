# Xaviar Milestone 4 Test Cases

Status: Executable release checklist

## 4A and 4B

- Event, reason, attribution, evidence, visibility, and threshold rules are documented.
- Recommendation, evidence, feedback, snapshot, prediction, and coaching-plan storage is versioned and workspace-scoped.
- Feedback creates audit history and cannot mutate an opportunity.
- Event-stream output excludes raw note bodies and contact values.

## 4C and 4D

- Empty periods return an explicit insufficient-evidence explanation.
- Recommendations include reason, action, confidence, priority, expiry, version, and evidence.
- Overdue work, missing next actions, proposal risk, loss patterns, duplicate candidates, and unassigned leads are handled.
- Contact fields never appear in evidence output.

## 4E and 4F

- Individual peers remain anonymous.
- Manager scope is limited to direct reports.
- Small samples suppress rankings and probabilities.
- Predictions contain sample size, confidence, date, expiry, and version.
- Holdout calibration scoring is deterministic and handles an empty set.
- Reassignment data is preserved for ownership-aware evaluation.

## 4G

- Admin, Marketing Manager, Sales Manager, Marketing Agent, and Sales Agent can open Xaviar.
- Each role receives only its permitted data scope.
- Daily, weekly, monthly, and lifetime periods are available.
- Evidence gaps, safety limits, strengths, risks, actions, and predictions have clear empty states.
- Recommendation acknowledgement, completion, and deferral do not change CRM data.

## 4H security and edge cases

- Missing or expired authentication returns 401.
- Cross-workspace and out-of-team coaching requests return 403.
- Unknown coaching subjects return 404.
- Prompt-injection text in notes is ignored.
- Email, phone, and raw notes are absent from Xaviar output.
- Xaviar has no delete, merge, reassignment, status-change, or outbound endpoint.
- Incorrect and duplicate decisions remain human-controlled.
- Missing dates, missing reasons, zero samples, small teams, delayed outcomes, and terminal records return safe outputs.
- API and web typechecks, all domain/Xaviar tests, production build, and repository whitespace validation pass.

## Human release gate

The technical implementation can pass all automated checks, but Gate G from `XAVIAR-EVALUATION-PLAN.md` still requires Admin and Manager review before Milestone 5 activation. Passing this checklist does not authorize real-data migration or live agent rollout.
