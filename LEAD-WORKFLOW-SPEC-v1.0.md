# Elevanta AI — Lead Workflow Specification v1.0

Status: Released with safe sample data on 2026-08-23; real-data migration remains Milestone 5 only

Decision authority: [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md)

This is the implementation-facing source of truth for lead creation, immediate assignment, Sales working, contact-quality management, activity logging, follow-ups, reassignment, role visibility, Admin review, and Xaviar evidence. It uses safe sample data until the separately controlled Milestone 5 migration.

The written screen and behavior contract is the repository source of truth. Removed Contacts must use an archive/hidden-from-focus symbol, never a trash/delete symbol. Dark mode must preserve the same information, actions, hierarchy, and responsive behavior while changing only theme tokens.

## 1. Product outcome

The workflow must make two jobs fast and unambiguous:

1. Marketing creates a complete lead, assigns it immediately, monitors downstream quality, and may later reassign it.
2. Sales works only assigned leads, cleans the working contact list, records real activities, schedules follow-ups, qualifies the opportunity, and preserves a complete history.

The interface must separate:

- **contact quality:** whether a phone number or email is usable;
- **activity:** what the Sales Agent did and what happened;
- **follow-up:** what must happen next and when;
- **lifecycle and qualification:** where the opportunity is in the sales process.

## 2. Authority matrix

| Capability | Marketing Agent / Lead Generator | Sales Agent | Marketing Manager | Sales Manager | Admin |
|---|---:|---:|---:|---:|---:|
| Create lead | Own leads | No | Team scope | No | Yes |
| Set MQL | Own leads | No | Team scope | No | Yes |
| Assign/reassign Sales owner | Own leads | No | Team scope | Direct-report scope | Yes |
| View complete assignment/contact-quality history | Own leads | Assigned, permission-filtered | Team scope | Direct-report scope | Yes |
| Log sales activity | No | Current assignment | No | No | Audit/correction only |
| Schedule sales follow-up | No | Current assignment | No | Direct-report intervention only | Yes |
| Set SQL and sales lifecycle stage | No | Current assignment | No | Correct in scope | Yes |
| Add/edit contact method after assignment | No | Current assignment | No | Correct in scope | Yes |
| Remove method from active focus | No | Current assignment | No | In-scope correction | Yes |
| Restore Incorrect/Wrong Person method | Own leads | Immediate Undo only | Team scope | Direct-report scope | Yes |
| Restore Do Not Contact | No | No | In-scope manager only | In-scope manager only | Yes |
| Submit incorrect-lead report | No | Current assignment, once | No | No | No |
| Decide three-agent incorrect review | No | No | No | No | Yes |

All Manager and Admin corrections create an audit event. Department scope and one-direct-manager rules remain unchanged.

## 3. End-to-end lead flow

### 3.1 Marketing creates and assigns

1. Marketing enters the lead's identity, description, source, project type, and one or more phone/email methods.
2. Existing duplicate checks run on normalized phone and email values.
3. Marketing may set MQL.
4. Marketing selects one Sales Agent and submits.
5. The assignment becomes active immediately. There is no Sales accept/reject step.
6. The assigned lead appears in the Sales Agent's priority queue.
7. The system starts the first-work timer from the assignment timestamp.

### 3.2 Sales opens the lead

The default Sales screen is `Overview`. It shows lead identity, lifecycle, temperature, read-only MQL state, Sales owner, source, next follow-up, description, project information, active contact methods, latest activity, and a collapsed Removed Contacts area.

Sales has one primary `Log Activity` action and one secondary `Add Contact` action. The default screen never shows a permanent activity form or the full timeline.

### 3.3 Sales manages contact methods

Each phone/email method has a current health and focus state.

| Health | Focus behavior | Meaning |
|---|---|---|
| Unverified | Active | Supplied but not confirmed |
| Verified | Active | Confirmed through a reliable response or authorized correction |
| Incorrect | Removed | The method does not reach the intended contact |
| Wrong Person | Removed | The method reaches a different person/business |
| Reception / Gatekeeper | Secondary | Potentially useful, but not a direct contact |
| Do Not Contact | Globally restricted | Must not be used for outreach |

Marking `Incorrect` or `Wrong Person` immediately removes the method from the Sales working list and offers a short Undo message. `Reception / Gatekeeper` moves to Secondary Contacts. `Do Not Contact` requires confirmation and becomes globally restricted.

`No Answer`, `Busy`, and `Voicemail` are not contact-health values. They are activity outcomes and leave the method active.

### 3.4 Sales logs activity

`Log Activity` opens an on-demand drawer and records:

- activity type: Call, SMS, Email, Meeting, or Note;
- selected contact method when applicable;
- controlled outcome;
- occurred time;
- note;
- optional contact-health change;
- whether a follow-up is required;
- follow-up due date/time, channel, and purpose.

Saving an activity and its optional follow-up is one transaction. A failed contact attempt counts as first work but does not count as Sales Engagement.

### 3.5 Sales Engagement and qualification

Manual Sales Acceptance is removed.

- `First Worked At` is the first eligible Sales activity after the assignment starts.
- `Connected At` is the first `Connected` activity outcome during an ownership interval.
- `SQL Entered At` is the first valid transition to SQL.
- `Sales Engaged At` is the earlier of Connected At and SQL Entered At.

Marketing owns MQL. Sales owns SQL. Sales cannot set MQL or reassign the opportunity.

### 3.6 History and follow-up

The `Activity History` tab displays a chronological, append-only view of user activities, follow-ups, contact-health changes, assignment changes, restorations, status/qualification changes, and system events. Automatic audit events are visually quieter than user actions.

The Overview shows only the latest activity and next follow-up summary. The full timeline remains on the separate tab.

### 3.7 Reassignment

Marketing, an authorized Manager, or Admin starts reassignment. The handoff screen shows:

- current and proposed Sales owner;
- handoff reason;
- full-context or fresh-start conversation visibility;
- active contact methods;
- secondary contact methods;
- methods removed by prior Sales Agents, including reason, actor, and date;
- per-method `Keep removed` or `Restore for new owner` decision.

`Keep removed` is the default. DNC methods cannot be restored by a normal Marketing Agent. The selected decisions are committed in the same transaction as the new assignment.

Fresh-start visibility affects conversation history only. It never clears contact-health, DNC, duplicate, incorrect-review, or audit state.

### 3.8 Incorrect-lead review

If all useful methods fail, the current Sales Agent may explicitly report the opportunity as incorrect with a required controlled reason. Contact-method removal alone does not create this report. One reporter counts once. Three distinct Sales Agents create exactly one Admin review item and pause further assignment until Admin decides `Confirm Incorrect`, `Reject`, or `Merge/Duplicate`.

## 4. Role-specific screen contract

### 4.1 Sales Agent

1. **Lead Overview:** sparse default view with lead information, active/secondary contacts, next follow-up, and latest activity.
2. **Log Activity drawer:** activity, outcome, notes, and optional follow-up.
3. **Activity History:** complete chronological record with type/date filters.
4. **Add/Edit Contact modal:** phone/email value, label, initial health, provenance note.
5. **Removed Contacts:** collapsed by default, with reason and actor; immediate Undo only for the current action.

### 4.2 Marketing Agent / Lead Generator

1. **Lead Overview:** lead identity, marketing owner, source, MQL, assigned Sales owner, Sales Engagement state, latest Sales activity summary, and next follow-up summary.
2. **Contact Quality:** separate Active, Secondary, and Removed groups. Removed rows show health reason, Sales Agent, assignment, and timestamp.
3. **Sales Progress:** read-only first-work, Connected, SQL, stage, follow-up, and activity history. Marketing does not log Sales activities.
4. **Reassign Lead drawer:** new Sales owner, reason, thread visibility, and per-method restoration decisions.
5. **Role actions:** Marketing may set/correct MQL, restore eligible methods, and reassign. It cannot set SQL, Sales lifecycle outcomes, log Sales work, or restore DNC.

### 4.3 Marketing Manager

- Same complete contact-quality and downstream Sales Progress visibility for marketing-team-owned leads.
- Team queue for high removal rates, repeated wrong-person results, missing active methods, restoration outcomes, and assigned-but-unworked leads.
- May restore eligible methods and reassign within approved scope.

### 4.4 Sales Manager

- Direct-report queue for assigned-but-unworked, overdue follow-ups, repeated failed attempts, no active contact method, and explicit incorrect reports.
- May correct contact focus/health and restore eligible methods inside direct-report scope.
- Sees named activity and quality evidence for managed Sales Agents, but cannot rewrite immutable events.

### 4.5 Admin

- Workspace-wide contact-quality audit and restoration history.
- DNC restoration control with reason and audit event.
- Three-agent Incorrect Review queue.
- Policy dictionaries for activity outcomes, contact health, removal reasons, and follow-up channels.
- Workspace reports for removed/restored methods, repeat bad data, assigned-but-unworked leads, Connected rate, SQL rate, and Sales Engagement.

## 5. Dashboard metric replacement

Remove `Sales Acceptance`, `Accepted`, `Unaccepted handoff`, and acceptance-rate cards/funnels.

Use these deterministic measures:

| Metric | Definition |
|---|---|
| Assigned but unworked | Active assignment with no eligible Sales activity in that ownership interval |
| Time to first sales activity | First Worked At minus assignment start |
| First contact completed | At least one Call/SMS/Email/Meeting activity |
| Connection rate | Opportunities with Connected outcome divided by eligible assigned opportunities |
| SQL rate | Opportunities entering SQL divided by eligible assigned opportunities |
| Sales Engagement rate | Opportunities with Connected or SQL divided by eligible assigned opportunities |
| Actionable contact yield | Leads with at least one Active non-DNC method divided by leads created |
| Contact removal rate | Removed methods divided by methods supplied, always shown with counts |
| Restoration success | Restored methods later producing Connected/Replied divided by restored methods with sufficient observation time |

Marketing funnel: `Created → MQL → Routed → First Worked → Connected → SQL → Won`.

Sales funnel: `Assigned → First Worked → Connected → SQL → Proposal → Won`.

## 6. Planned database changes

The existing `contacts.normalized_phone` and `contacts.normalized_email` fields cannot support the approved workflow alone. The implementation must add normalized child records and preserve the existing fields temporarily for migration compatibility.

### New tables

```text
contact_methods
  id, workspace_id, contact_id, method_type, normalized_value, display_value,
  label, global_restriction, created_by, created_at, updated_at

opportunity_contact_methods
  id, opportunity_id, contact_method_id, health_status, focus_state,
  current_reason_code, last_assessed_by, last_assessed_at, version

contact_method_events
  id, workspace_id, opportunity_id, assignment_id, contact_method_id,
  actor_id, event_type, from_health, to_health, from_focus, to_focus,
  reason_code, note, related_activity_id, created_at

assignment_contact_method_decisions
  id, assignment_id, contact_method_id, decision, prior_focus_state,
  resulting_focus_state, decided_by, reason, created_at
```

### Existing-table extensions

- `activities`: structured activity type, controlled outcome, contact method, occurred time, and metadata version.
- `follow_ups`: channel, purpose, source activity, timezone, and cancellation reason.
- `assignments`: reassignment review completion and event-contract version.
- `opportunities`: derived Sales Engagement timestamps may be exposed through a view rather than stored mutable fields.

### Database rules

- Unique normalized method value within a workspace/contact policy, with duplicate-candidate handling instead of silent merging.
- One opportunity/contact-method link per pair.
- Optimistic version check prevents two users overwriting contact state.
- Every state change writes an immutable `contact_method_events` and `audit_events` row.
- DNC blocks outreach and restoration by unauthorized roles.
- RLS follows workspace, marketing ownership, active assignment, and manager scope.
- Current state and event insert occur in one transaction.
- Imported history is marked separately and never presented as newly recorded behavior.

## 7. Planned API changes

```text
GET    /v1/opportunities/:id/contact-methods
POST   /v1/opportunities/:id/contact-methods
PATCH  /v1/opportunities/:id/contact-methods/:methodId
POST   /v1/opportunities/:id/contact-methods/:methodId/assess
POST   /v1/opportunities/:id/contact-methods/:methodId/restore
POST   /v1/opportunities/:id/activities/log
GET    /v1/opportunities/:id/activity-history
POST   /v1/opportunities/:id/reassignments/preview
POST   /v1/opportunities/:id/reassignments/commit
```

All mutations require authentication, role authorization, schema validation, idempotency, current-assignment validation, and audit creation. Activity plus follow-up and reassignment plus contact decisions are transactional operations.

## 8. Xaviar event and reasoning update

Add these evidence events:

- `contact_method_added`
- `contact_method_updated`
- `contact_method_assessed`
- `contact_method_removed_from_focus`
- `contact_method_moved_to_secondary`
- `contact_method_restored`
- `contact_method_dnc_applied`
- `sales_activity_logged`
- `sales_first_worked`
- `sales_connected`
- `sales_sql_entered`
- `sales_engaged`
- `reassignment_contact_decision`

Xaviar must:

- treat contact health and activity outcomes as different evidence types;
- attribute Sales behavior only inside the active ownership interval;
- attribute supplied-contact quality to the recorded Marketing owner;
- never treat No Answer, Busy, or Voicemail as permanent invalidity;
- never treat a removed method as a deleted record;
- measure restoration success only after enough observation time;
- explain whether Sales Engagement came from Connected or SQL;
- suppress coaching when timestamps, ownership, or sample size are insufficient;
- keep raw phone numbers, emails, and unnecessary note text out of evidence payloads;
- remain advisory and permission-safe.

## 9. Required edge cases and security tests

1. Duplicate phone/email is detected before insert without overwriting another contact.
2. Two users assess the same method concurrently; one receives a safe version conflict.
3. A Sales Agent cannot update a lead after their assignment ends.
4. A Sales Agent cannot reassign, set MQL, restore an expired removal, or restore DNC.
5. Marketing cannot log Sales activity, set SQL, or see another marketer's lead outside scope.
6. Fresh-start assignment does not reactivate suppressed methods or expose restricted history.
7. Reassignment commits the assignment and every per-method decision atomically.
8. DNC is enforced across every opportunity for the contact method.
9. Reception/Gatekeeper moves to Secondary, not Removed.
10. No Answer, Busy, and Voicemail leave contact health unchanged.
11. An activity and its follow-up either both save or both fail.
12. Contact removal alone does not create an incorrect-lead report.
13. One Sales Agent cannot count twice toward the three-agent threshold.
14. The third distinct report creates one review item and pauses reassignment.
15. Rejected Admin review preserves every report and restoration event.
16. Activity history cannot be edited or deleted through normal role APIs.
17. Xaviar cannot reveal raw contact values or another agent's restricted evidence.
18. Imported historical events do not affect new-behavior coaching without approval.
19. Time-to-first-work uses the correct ownership interval and timezone.
20. Sales Engagement is derived once from the earliest Connected or SQL event and remains explainable after reassignment.

## 10. Development sequence

1. Approve and freeze this specification.
2. Add schema migration and RLS policies using safe sample data only.
3. Add transactional database functions and typed API contracts.
4. Build shared contact-method and activity components.
5. Implement Sales screens.
6. Implement Marketing reassignment/contact-quality screens.
7. Implement Manager and Admin oversight screens.
8. Extend Xaviar event stream, calculations, explanations, and tests.
9. Run permission, edge-case, responsive, dark/light, API, database, and regression tests.
10. Release through the existing Git-connected Vercel deployment only after approval.

Real Excel data remains out of scope until Milestone 5.
