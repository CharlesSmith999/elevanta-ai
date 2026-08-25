# Lead CRM — Phase 1 Product and Technical Plan

Status: Planning baseline, approved from stakeholder answers

Branding: The product is named **Elevanta AI**. Its embedded AI sales companion is named **Xaviar**. Xaviar is advisory in Phase 1 and supports lead analysis, follow-up guidance, agent and marketer coaching, and performance reporting. Autonomous outbound communication remains deferred to Phase 2.

CRM readiness reference: [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md). Shared dashboard definitions are in [DASHBOARD-DATA-DICTIONARY.md](./DASHBOARD-DATA-DICTIONARY.md), the released dashboard baseline is in [DASHBOARD-COMPLETION-PLAN.md](./DASHBOARD-COMPLETION-PLAN.md), and the approved redesign decisions are in [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md). The current lead-workflow authority is [CRM-DECISIONS-v1.7.md](./CRM-DECISIONS-v1.7.md), extending [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md), with its full role, screen, data, API, security, and Xaviar contract in [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md). Xaviar evaluation reference: [XAVIAR-EVALUATION-PLAN.md](./XAVIAR-EVALUATION-PLAN.md).

## 1. Product vision

Replace the current multi-tab Excel lead process with a shared CRM for sales agents, managers, marketers, and administrators. The CRM must preserve the complete history of every lead while allowing a reassigned agent to receive either the full prior thread or a fresh working view. Managers and administrators always retain the full history.

Phase 1 is an internal operating system. Phase 2 adds workflow automation and AI-assisted email, SMS, and calling. Phase 3 packages the platform as a multi-tenant SaaS product.

## 2. Confirmed users and permissions

| Role | Scope | Core capabilities |
|---|---|---|
| Sales agent | Assigned leads only | Work assigned leads, manage multiple contact methods, log structured activities, set SQL/sales stages, schedule follow-ups, report incorrect leads |
| Manager | Leads inside department/direct-report scope | Reassign in scope, inspect contact/activity history, restore eligible methods, monitor pipeline and performance, review coaching |
| Marketer | Leads created or owned by marketing | Create/import and immediately route leads, set MQL, see complete background/contact quality, restore eligible methods, and reassign |
| Admin | Entire workspace | User/team setup, all data, policy decisions, incorrect-lead approval, dashboards, exports |

Agents do not see unassigned or other agents' contact details. Managers see the leads of agents tagged to them. Marketers, managers, and admins always see the complete lead background.

## 3. Core data concepts

The model uses both a canonical contact and one or more opportunities. A contact is the person/company identity. An opportunity is a specific project/request that can be routed, worked, won, or lost independently.

An assignment is a time-bounded ownership event, not an overwrite. Every assignment records who routed it, who received it, when it happened, the reason, and whether the recipient received the prior thread. Lead activity is append-only for auditability.

### Canonical entities

- `workspace`: future SaaS tenant boundary; one internal workspace in Phase 1.
- `user`: authenticated person with role and manager relationship.
- `contact`: normalized name, phone, email, source identity, duplicate keys, and consent flags.
- `contact_method`: one normalized phone or email for a contact, including global restriction state.
- `opportunity_contact_method`: the method's health and active/secondary/removed focus for one opportunity.
- `contact_method_event`: immutable assessment, removal, restoration, and DNC history.
- `opportunity`: project type, description, budget/timeline signals, current status, and qualification fields.
- `assignment`: routing history and current assignee.
- `assignment_contact_method_decision`: per-method keep-removed/restore choice for a new assignment.
- `activity`: calls, emails, SMS, meetings, notes, structured outcomes, status/qualification changes, reminders, and system events.
- `follow_up`: next action, due time, completion, escalation state.
- `incorrect_report`: agent's incorrect classification with reason and evidence.
- `incorrect_review`: admin decision after the three-agent threshold.
- `ai_evaluation`: explainable coaching metrics and generated recommendations.
- `notification`: in-app and email reminder/event queue.

## 4. Standard lifecycle

`New → Assigned → Contacted → Connected → Follow-up Required → Qualified → Proposal Sent → Won/Lost`

Terminal or exception statuses: `Not Interested`, `Incorrect`, `Duplicate`, `Do Not Contact`.

Status changes require actor, timestamp, previous status, new status, and optional reason. Agents can update working statuses for assigned leads. Managers/admins can correct status and reassign. A status change never deletes prior status history.

## 5. Routing and history rules

1. Marketing creates/imports a lead and may assign it to an initial agent. The assignment is active immediately; Sales does not accept or reject it.
2. A manager, marketer, or admin can reassign it.
3. Reassignment offers two views to the receiving agent:
   - `full_context`: prior notes, statuses, calls, and outcomes are visible;
   - `fresh_start`: the agent sees a clean work queue, while the full history remains available to marketer/manager/admin.
4. The selected visibility mode is recorded on the assignment.
5. The system must show the reassignment chain and the reason for each handoff.
6. Reassignment also shows every contact method removed by a prior Sales Agent. The assigner chooses whether each eligible method remains removed or is restored for the new owner; keep-removed is the default.
7. Fresh-start visibility never reactivates an incorrect, wrong-person, or DNC method.

Manual `Sales Acceptance` is retired. The CRM records `First Worked At` from the first eligible sales activity and derives `Sales Engaged At` from the earliest successful `Connected` outcome or SQL transition. A failed attempt counts as first work but not Sales Engagement.

## 6. Incorrect-lead control

An agent may submit one incorrect report per opportunity/contact assignment, with a required reason selected from a controlled list plus optional evidence. The same agent cannot count twice toward the threshold.

When three different agents report the same contact/opportunity as incorrect:

1. The record moves to an admin `Incorrect Review` queue.
2. It is not automatically deleted or permanently blocked.
3. New assignment is paused while review is pending.
4. Admin chooses `Confirm Incorrect`, `Reject`, or `Merge/Duplicate` and supplies a reason.
5. Confirmed incorrect records are sidelined and excluded from normal routing; rejected reports remain in audit history.

## 7. Phase 1 scope

### Included

- Import and normalize the Excel source data.
- Contact/opportunity/assignment/history model.
- Role-based access and manager hierarchy.
- Lead inbox, lead detail, assignment, status updates, notes, and follow-up dates.
- Reminder notifications and overdue follow-up indicators.
- Incorrect-lead reporting and admin review queue.
- Manager/admin dashboards.
- Agent and marketer performance/coaching views.
- Explainable AI-generated coaching summaries using CRM data.
- Audit log, exports, and data-quality reporting.

### Deferred to later phases

- Daily digest and escalation automation beyond basic overdue indicators.
- Native Bark connector.
- Email, SMS, calendar, phone, and call transcription integrations.
- AI autonomous outbound email, SMS, and calls.
- Public SaaS billing, tenant self-service, white-labeling, and marketplace integrations.

## 8. Dashboards and wireframes

### Agent workspace

Top cards: assigned open leads, due today, overdue, connected rate. Main area: sortable lead queue with status, next action, due date, source, and priority. The approved lead workspace uses a sparse Overview, on-demand Log Activity drawer, separate Activity History, Add/Edit Contact modal, active/secondary/removed contact groups, and one-click follow-up creation as defined in [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md).

### Manager dashboard

Filters: date range, agent, source, project type, status. Cards: pipeline by status, contact rate, qualified rate, win rate, overdue follow-ups, incorrect-review queue. Tables: agent comparison, aging leads, handoff history, and coaching recommendations.

### Admin dashboard

Workspace health: total contacts, duplicate candidates, missing contact fields, unclassified statuses, incorrect review queue, assignment imbalance, conversion funnel, and trend lines. Admin can drill into any metric and export filtered data.

### Marketer dashboard

Lead volume by source/campaign, actionable-contact yield, duplicate rate, incorrect/wrong-person rate, routing speed, time to first Sales work, Sales Engagement, SQL, and downstream conversion. Includes a lead-import validation report before records enter the active queue and a contact-quality/reassignment workspace after routing.

### Approved dashboard-revamp direction

The next dashboard implementation follows [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md). Every role view begins with urgent work, then selected-period performance, then an evidence-backed improvement area, followed by permitted recognition and benchmark context. The current non-governed Lead Score preview must be removed as part of that implementation. Final screen layouts require a separately approved role-by-role screen specification before implementation.

## 9. AI coaching and reporting

AI is advisory and explainable in Phase 1. It must cite the CRM events used to produce a recommendation and never silently change status or send an outbound message.

Agent and marketer scores:

- response speed;
- follow-up consistency and overdue rate;
- conversion by lifecycle stage;
- completeness and quality of notes;
- qualification accuracy, measured against later outcomes;
- communication quality, when message/call data exists;
- data hygiene and correct routing behavior.

Reports show trend versus the agent's prior period, team benchmark, strengths, risks, and two or three recommended actions. Managers/admins can review, annotate, and export reports. Marketers receive the same quality-improvement treatment for source quality, duplicate prevention, and routing accuracy.

### Xaviar operating model

Xaviar is an embedded role-aware coach inside every dashboard, not a separate reporting page. It works in six steps: explain what happened, diagnose why it happened, recommend the next action, coach the user, monitor whether the advice was followed, and later assist with approved actions.

All Xaviar implementation and release testing must follow the focused [Xaviar Evaluation Plan](./XAVIAR-EVALUATION-PLAN.md), which defines evidence requirements, role-specific tests, fairness rules, safety checks, release gates, and post-activation monitoring.

Xaviar supports each lead stage:

- **New:** validate completeness, detect duplicate candidates, predict quality, and recommend routing.
- **Assigned:** summarize background, prioritize the queue, and recommend full-context or fresh-start handling.
- **Contacted:** monitor response speed, note quality, follow-up timing, and conversation preparation.
- **Connected:** suggest qualification questions, MQL/SQL guidance, and next steps.
- **Qualified:** predict conversion likelihood, identify missing information, and recommend proposal timing.
- **Proposal sent:** monitor risk, recommend follow-up timing, and compare similar won opportunities.
- **Won:** capture the behaviors and sources that contributed to success as team best practices.
- **Lost/not interested:** identify loss patterns, recommend improvements, and suggest a safe reactivation window when appropriate.
- **Incorrect/duplicate:** summarize evidence for human review; Xaviar never deletes or merges records autonomously.

Role-specific coaching:

- **Sales agents:** personalized prioritization, conversion coaching, follow-up coaching, and comparison with anonymized best-practice patterns from strong agents.
- **Marketers:** source and campaign quality analysis, duplicate/incorrect prevention, targeting and routing recommendations, and lead-quality coaching.
- **Managers:** team benchmarking by skill, coaching plans, improvement tracking, and alerts for declining performance or repeated missed actions.
- **Admins:** organization-wide trend analysis, process bottlenecks, data-quality risks, forecasts, and leadership reports.

Xaviar must retain the advice, the evidence behind it, whether it was followed, and the resulting outcome so coaching can be measured over time. Benchmarks must be permission-aware and privacy-safe; agents receive useful patterns without exposing another person’s private contact data.

Xaviar must keep contact health separate from activity outcomes. Contact-method additions, assessments, removals, restorations, DNC restrictions, Sales activities, first-work, Connected, SQL, Sales Engagement, and reassignment contact decisions become explainable evidence events. Xaviar never treats No Answer, Busy, or Voicemail as permanent invalidity and never treats a removed method as deleted.

## 10. Supabase database schema (baseline)

```sql
workspaces(id, name, created_at)
users(id, workspace_id, role, manager_id, name, email, active, created_at)
contacts(id, workspace_id, name, normalized_phone, normalized_email, source, source_external_id, do_not_contact, created_at, updated_at)
contact_methods(id, workspace_id, contact_id, method_type, normalized_value, display_value, label, global_restriction, created_by, created_at, updated_at)
opportunity_contact_methods(id, opportunity_id, contact_method_id, health_status, focus_state, current_reason_code, last_assessed_by, last_assessed_at, version)
contact_method_events(id, workspace_id, opportunity_id, assignment_id, contact_method_id, actor_id, event_type, from_health, to_health, from_focus, to_focus, reason_code, note, related_activity_id, created_at)
opportunities(id, workspace_id, contact_id, project_type, description, budget_band, timeline_band, source, status, priority, total_project_cost, upfront_payment_amount, won_at, created_at, updated_at)
assignments(id, opportunity_id, assigned_to, assigned_by, visibility_mode, reason, started_at, ended_at)
assignment_contact_method_decisions(id, assignment_id, contact_method_id, decision, prior_focus_state, resulting_focus_state, decided_by, reason, created_at)
activities(id, opportunity_id, assignment_id, actor_id, type, outcome, contact_method_id, body, occurred_at, from_status, to_status, metadata, created_at)
follow_ups(id, opportunity_id, owner_id, source_activity_id, due_at, action_type, channel, purpose, timezone, status, completed_at, escalated_at, created_at)
incorrect_reports(id, opportunity_id, reporter_id, reason_code, evidence, created_at)
incorrect_reviews(id, opportunity_id, threshold_reached_at, reviewer_id, decision, decision_reason, decided_at)
ai_evaluations(id, workspace_id, subject_user_id, subject_type, period_start, period_end, metrics_json, recommendations_json, generated_at, reviewed_by)
notifications(id, user_id, type, payload_json, read_at, sent_at, created_at)
audit_events(id, workspace_id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at)
```

Required constraints/indexes: unique normalized email/phone within workspace where present; one active assignment per opportunity; unique incorrect report per opportunity/reporter; indexes on workspace, status, assignee, source, due date, and created date. Use import provenance to identify historical records and CRM form creation to identify new records; do not require a user-maintained origin field. Use Supabase Row Level Security for role and manager-scope enforcement.

The detailed additive migration, compatibility, concurrency, DNC, audit, and RLS requirements are governed by [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md). Existing single phone/email columns remain only as a temporary migration compatibility layer until canonical contact methods are populated and verified.

## 11. Node.js/React architecture

- Frontend: React with a role-aware shell, lead queue, detail view, dashboards, and review screens.
- API: Node.js service with typed request/response contracts, validation, authorization middleware, and audit-event creation in the same transaction boundary.
- Data: Supabase PostgreSQL, migrations committed to git, Row Level Security policies tested with representative roles.
- Background jobs: notification and AI report jobs behind an interface so Phase 2 integrations can be added without changing the core domain model.
- Deployment: deployment target to be confirmed; the current assumption is a static React frontend plus managed Node API/Supabase. GitHub Pages is suitable for static frontend assets but not for the Node API.

## 12. API plan

Initial REST resources:

- `GET/POST /contacts`
- `GET/PATCH /opportunities/:id`
- `POST /opportunities/:id/assignments`
- `POST /opportunities/:id/activities`
- `GET/POST/PATCH /opportunities/:id/contact-methods`
- `POST /opportunities/:id/contact-methods/:methodId/assess`
- `POST /opportunities/:id/contact-methods/:methodId/restore`
- `GET /opportunities/:id/activity-history`
- `POST /opportunities/:id/reassignments/preview`
- `POST /opportunities/:id/reassignments/commit`
- `POST /opportunities/:id/follow-ups`
- `POST /opportunities/:id/incorrect-reports`
- `GET /admin/incorrect-reviews`
- `POST /admin/incorrect-reviews/:id/decision`
- `GET /dashboards/agent|manager|admin|marketer`
- `GET /coaching/:userId`
- `POST /imports/validate` and `POST /imports/commit`

All mutating endpoints require authenticated user, role authorization, idempotency where applicable, and an audit event.

## 13. Excel import and cleanup specification

Import into a staging area first. Preserve the original workbook/tab/row as provenance. Normalize phone numbers, emails, names, dates, agent names, and status labels. Split project detail text from structured qualification fields when confidently detectable; retain the raw text unchanged.

Deduplication keys: normalized email, normalized phone, and a fuzzy name-plus-contact candidate. Never silently merge; present candidates for review. Map legacy status variants to the standard lifecycle while retaining the original value. Rows with no usable contact method enter a data-quality queue instead of active routing.

## 14. Security, privacy, and audit

- Least-privilege role access through Supabase RLS and server authorization.
- Contact details hidden from agents outside their assignment scope.
- Immutable audit history for assignments, status changes, incorrect reports, admin decisions, and exports.
- Explicit do-not-contact state and future consent fields before Phase 2 automation.
- AI prompts must minimize personal data and store generated report metadata, not unnecessary raw transcripts.

## 15. Implementation roadmap

### Milestone 0 — planning and validation

Finalize this plan, confirm deployment choice, define status/reason dictionaries, approve data-cleanup rules, and create a small import acceptance sample.

### Milestone 1 — foundation

Initialize React/Node project, Supabase project, migrations, authentication, roles, manager hierarchy, RLS, audit events, and CI checks.

### Milestone 2 — CRM core

Contact/opportunity views, assignment history, statuses, notes, follow-ups, and agent/manager permissions using safe sample data. The production Excel lead-data migration is intentionally deferred until after Milestone 4.

### Milestone 3 — controls and dashboards

Incorrect review queue, duplicate review, overdue indicators, dashboards, source-aware reporting, won financial fields, Benchmark Board, Leaderboard, exports, and data-quality reports. Follow [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md). Exact benchmark cohort rules remain open for later Xaviar evaluation.

### Pre-Xaviar product refinement gate

Before Milestone 4/Xaviar development begins, complete one focused refinement pass over the CRM screens using the approved role workflows and safe sample data. This is a required release gate, not a new milestone and not a substitute for the dashboard completion gates.

The refinement pass must:

- review every role's dashboard, lead inbox, lead detail, assignment, follow-up, reports, review-queue, and Xaviar entry screens;
- add, remove, or rename buttons only where the approved workflow requires it;
- standardize form fields, required fields, dropdown values, date/time controls, empty states, error messages, and confirmation messages;
- verify that actions are visible only to the correct role and that contact details remain protected;
- test keyboard access, readable labels, responsive layout, destructive-action confirmation, and audit-history visibility;
- record each approved screen change in a short UI change log and validate it with role-based smoke tests;
- freeze the Phase 1 screen and field contract before Xaviar data and coaching work starts.

No Xaviar feature may be treated as complete while an unresolved screen or form change would alter the underlying event, permission, or dashboard data contract.

### Milestone 4 — AI support

Embedded Xaviar coach with explainable daily/weekly/monthly/lifetime views, lead-stage recommendations, personalized agent and marketer coaching, skill-based team benchmarks, manager review, and improvement tracking. Xaviar remains advisory and does not change records or send outbound messages.

Milestone 4 implementation is not complete until the applicable gates in [XAVIAR-EVALUATION-PLAN.md](./XAVIAR-EVALUATION-PLAN.md) pass.

Milestone 4 is delivered in the following controlled sub-phases:

1. **4A — Data contract and readiness:** finalize the event dictionary, outcome/reason lists, attribution rules, minimum sample rules, role visibility rules, and Xaviar evidence requirements before model work begins.
2. **4B — Xaviar data foundation:** create the event/query layer, performance snapshots, data-quality checks, recommendation ledger, evidence references, feedback states, and model/version audit fields. Use synthetic or safe sample data only.
3. **4C — Explain:** show daily, weekly, monthly, and lifetime summaries; lead-stage explanations; missing-data warnings; and evidence links. No predictions or rankings are shown as facts.
4. **4D — Recommend:** add lead prioritization, next-action suggestions, follow-up guidance, qualification guidance, loss-pattern guidance, and marketer source-quality recommendations. Every recommendation has confidence, evidence, expiry, and a human-readable reason.
5. **4E — Coach and benchmark:** add role-specific coaching, permission-safe skill benchmarks, cohort comparisons, manager coaching plans, and recommendation acknowledgement/completion tracking. Small samples produce “not enough evidence,” not rankings.
6. **4F — Predict and calibrate:** add connection, qualification, conversion, follow-up-risk, and lead-quality forecasts only after testing against held-out sample outcomes. Store confidence, model version, prediction date, and later outcome for calibration.
7. **4G — Dashboard integration:** embed Xaviar in the agent, marketer, manager, and admin dashboards with role-specific views and clear explanations of what Xaviar can and cannot see.
8. **4H — Safety and release evaluation:** test permissions, reassignment attribution, duplicate/incorrect cases, missing data, small teams, delayed outcomes, bias, prompt injection in notes, and unsupported recommendations. Complete manager/admin review before release.

Milestone 4 is a build and validation milestone, not an operational rollout. Agents and marketers do not start using the CRM for live work until Milestone 5 has completed data migration, validation, and activation approval.

### Milestone 5 — Production data migration

Stage and import the approved Excel lead data, preserve workbook/tab/row provenance, apply deterministic duplicate handling, validate permissions and dashboard reconciliation, and only then activate the migrated records for normal routing.

After activation, newly recorded CRM work becomes Xaviar’s primary source for personalized coaching. Imported historical data is labeled as historical context and is used only when its provenance and quality are sufficient.

### Lead workflow v1.6 implementation gate

Before Milestone 5 activation, implement and validate [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md) with safe sample data. This gate replaces manual Sales Acceptance with derived First Worked, Connected, SQL, and Sales Engagement evidence; adds multiple contact methods and immutable contact-quality history; and completes the Sales, Marketing, Manager, Admin, database/API, and Xaviar changes. No real Excel data is imported during this gate.

### Phase 2 — workflow automation

Track whether Xaviar recommendations are followed, send in-app reminders and escalations, provide daily task guidance, and add email/SMS/calendar/phone connectors with consent enforcement, templates, and human approval gates. Any outbound action requires explicit approval until autonomous operation is separately approved.

### Phase 3 — SaaS product

Multi-tenancy hardening, billing, self-service administration, onboarding, usage limits, tenant-level AI configuration, and product analytics.

## 16. Acceptance criteria for Phase 1

- Every imported record has provenance and a deterministic deduplication outcome.
- An agent cannot read another agent's unassigned contact details.
- Managers see only their managed agents' leads; admins see all.
- Reassignment preserves the complete audit chain and supports full-context/fresh-start visibility.
- Assignment is immediate and never waits for a Sales accept/reject action.
- First Worked and Sales Engagement reconcile to structured activity/SQL evidence.
- Multiple contact methods preserve immutable assessment, removal, restoration, and DNC history.
- Fresh-start reassignment never reactivates suppressed contact methods.
- Three distinct Sales Agent incorrect reports create exactly one admin review item and pause assignment. Authorized Marketing, Manager, and Admin flags remain visible evidence but do not increase the automatic threshold.
- Status, follow-up, and assignment changes are auditable.
- Dashboards reconcile to the underlying opportunity table.
- AI reports identify evidence, trend, and actions without autonomous outbound communication.
- No Phase 2 integration is enabled until consent, unsubscribe, and human-approval policies are implemented.

## 17. Decisions still required before future implementation

1. Confirm the first import sample and the admin responsible for deduplication review during Milestone 5.
2. Decide the final benchmark cohort and agent-visibility rules after Xaviar evaluation, using actual CRM evidence.
3. Approve final Lead Generator and reassignment visual references before lead-workflow v1.6 development begins.

Approved dashboard and operating decisions are recorded in [CRM-DECISIONS-v1.5.md](./CRM-DECISIONS-v1.5.md), [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md), and [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md).
