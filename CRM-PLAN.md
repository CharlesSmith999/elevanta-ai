# Lead CRM — Phase 1 Product and Technical Plan

Status: Planning baseline, approved from stakeholder answers

Branding: The product is named **Elevanta AI**. Its embedded AI sales companion is named **Xaviar**. Xaviar is advisory in Phase 1 and supports lead analysis, follow-up guidance, agent and marketer coaching, and performance reporting. Autonomous outbound communication remains deferred to Phase 2.

## 1. Product vision

Replace the current multi-tab Excel lead process with a shared CRM for sales agents, managers, marketers, and administrators. The CRM must preserve the complete history of every lead while allowing a reassigned agent to receive either the full prior thread or a fresh working view. Managers and administrators always retain the full history.

Phase 1 is an internal operating system. Phase 2 adds workflow automation and AI-assisted email, SMS, and calling. Phase 3 packages the platform as a multi-tenant SaaS product.

## 2. Confirmed users and permissions

| Role | Scope | Core capabilities |
|---|---|---|
| Sales agent | Assigned leads only | Work assigned leads, update status, add notes, schedule follow-ups, report incorrect leads |
| Manager | All leads assigned to managed agents | Reassign leads, inspect history, monitor pipeline and performance, review coaching |
| Marketer | Leads created or owned by marketing | Create/import leads, route leads, see complete background, review marketing quality |
| Admin | Entire workspace | User/team setup, all data, policy decisions, incorrect-lead approval, dashboards, exports |

Agents do not see unassigned or other agents' contact details. Managers see the leads of agents tagged to them. Marketers, managers, and admins always see the complete lead background.

## 3. Core data concepts

The model uses both a canonical contact and one or more opportunities. A contact is the person/company identity. An opportunity is a specific project/request that can be routed, worked, won, or lost independently.

An assignment is a time-bounded ownership event, not an overwrite. Every assignment records who routed it, who received it, when it happened, the reason, and whether the recipient received the prior thread. Lead activity is append-only for auditability.

### Canonical entities

- `workspace`: future SaaS tenant boundary; one internal workspace in Phase 1.
- `user`: authenticated person with role and manager relationship.
- `contact`: normalized name, phone, email, source identity, duplicate keys, and consent flags.
- `opportunity`: project type, description, budget/timeline signals, current status, and qualification fields.
- `assignment`: routing history and current assignee.
- `activity`: calls, emails, SMS, notes, status changes, reminders, and system events.
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

1. Marketing creates/imports a lead and may assign it to an initial agent.
2. A manager, marketer, or admin can reassign it.
3. Reassignment offers two views to the receiving agent:
   - `full_context`: prior notes, statuses, calls, and outcomes are visible;
   - `fresh_start`: the agent sees a clean work queue, while the full history remains available to marketer/manager/admin.
4. The selected visibility mode is recorded on the assignment.
5. The system must show the reassignment chain and the reason for each handoff.

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

Top cards: assigned open leads, due today, overdue, connected rate. Main area: sortable lead queue with status, next action, due date, source, and priority. Detail drawer: contact, opportunity, current assignment, visible history, notes, and one-click follow-up.

### Manager dashboard

Filters: date range, agent, source, project type, status. Cards: pipeline by status, contact rate, qualified rate, win rate, overdue follow-ups, incorrect-review queue. Tables: agent comparison, aging leads, handoff history, and coaching recommendations.

### Admin dashboard

Workspace health: total contacts, duplicate candidates, missing contact fields, unclassified statuses, incorrect review queue, assignment imbalance, conversion funnel, and trend lines. Admin can drill into any metric and export filtered data.

### Marketer dashboard

Lead volume by source/campaign, lead quality, duplicate rate, incorrect rate, routing speed, and downstream conversion. Includes a lead-import validation report before records enter the active queue.

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

## 10. Supabase database schema (baseline)

```sql
workspaces(id, name, created_at)
users(id, workspace_id, role, manager_id, name, email, active, created_at)
contacts(id, workspace_id, name, normalized_phone, normalized_email, source, source_external_id, do_not_contact, created_at, updated_at)
opportunities(id, workspace_id, contact_id, project_type, description, budget_band, timeline_band, source, status, priority, created_at, updated_at)
assignments(id, opportunity_id, assigned_to, assigned_by, visibility_mode, reason, started_at, ended_at)
activities(id, opportunity_id, actor_id, type, body, from_status, to_status, metadata, created_at)
follow_ups(id, opportunity_id, owner_id, due_at, action_type, status, completed_at, escalated_at, created_at)
incorrect_reports(id, opportunity_id, reporter_id, reason_code, evidence, created_at)
incorrect_reviews(id, opportunity_id, threshold_reached_at, reviewer_id, decision, decision_reason, decided_at)
ai_evaluations(id, workspace_id, subject_user_id, subject_type, period_start, period_end, metrics_json, recommendations_json, generated_at, reviewed_by)
notifications(id, user_id, type, payload_json, read_at, sent_at, created_at)
audit_events(id, workspace_id, actor_id, entity_type, entity_id, action, before_json, after_json, created_at)
```

Required constraints/indexes: unique normalized email/phone within workspace where present; one active assignment per opportunity; unique incorrect report per opportunity/reporter; indexes on workspace, status, assignee, due date, and created date. Use Supabase Row Level Security for role and manager-scope enforcement.

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

Import staging/commit flow, contact/opportunity views, assignment history, statuses, notes, follow-ups, and agent/manager permissions.

### Milestone 3 — controls and dashboards

Incorrect review queue, duplicate review, overdue indicators, dashboards, exports, and data-quality reports.

### Milestone 4 — AI support

Explainable coaching metrics, marketer quality report, manager review workflow, and periodic report generation.

### Phase 2 — workflow automation

Email/SMS/calendar/phone connectors, daily task digests, escalations, templates, consent enforcement, and human approval gates.

### Phase 3 — SaaS product

Multi-tenancy hardening, billing, self-service administration, onboarding, usage limits, tenant-level AI configuration, and product analytics.

## 16. Acceptance criteria for Phase 1

- Every imported record has provenance and a deterministic deduplication outcome.
- An agent cannot read another agent's unassigned contact details.
- Managers see only their managed agents' leads; admins see all.
- Reassignment preserves the complete audit chain and supports full-context/fresh-start visibility.
- Three distinct incorrect reports create exactly one admin review item and pause assignment.
- Status, follow-up, and assignment changes are auditable.
- Dashboards reconcile to the underlying opportunity table.
- AI reports identify evidence, trend, and actions without autonomous outbound communication.
- No Phase 2 integration is enabled until consent, unsubscribe, and human-approval policies are implemented.

## 17. Decisions still required before coding

1. Confirm the deployment target for the Node API; GitHub Pages cannot host the API.
2. Confirm authentication provider and whether managers can belong to multiple teams.
3. Approve the controlled reason lists for incorrect reports, loss reasons, and follow-up actions.
4. Decide whether marketing is a separate role in the UI or a permission set layered onto a user.
5. Confirm the first import sample and the admin responsible for deduplication review.
