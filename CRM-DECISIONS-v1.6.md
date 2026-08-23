# Elevanta AI — Lead Workspace and Sales Engagement Decisions v1.6
Status: Approved by product owner on 2026-08-23

This version extends [CRM-DECISIONS-v1.5.md](./CRM-DECISIONS-v1.5.md). It records the approved lead-generation, sales-working, contact-quality, reassignment, and Sales Engagement decisions. Where this file conflicts with an earlier decision record, this file governs the lead workflow.

| Decision | Approved rule |
|---|---|
| Assignment delivery | A lead reaches the selected Sales Agent immediately when Marketing assigns it. Sales does not accept or reject the assignment. |
| Sales Engagement | Replace manual `Sales Acceptance` with derived `Sales Engagement`. A lead becomes Sales Engaged at the first successful `Connected` activity outcome or when Sales marks it `SQL`, whichever happens first. |
| First-work measurement | Track first sales activity separately from Sales Engagement. Dashboards may show assigned-but-unworked count and time to first sales activity. |
| Qualification ownership | Marketing may set MQL. Sales may set SQL. Sales cannot set MQL or reassign a lead. Managers and Admin may correct either with audit history. |
| Contact methods | One contact may have multiple phone numbers and email addresses. Sales may add or edit a contact method while owning the opportunity. Original values and every change remain auditable. |
| Contact health | Contact health is separate from activity outcomes. Approved health values are `Unverified`, `Verified`, `Incorrect`, `Wrong Person`, `Reception / Gatekeeper`, and `Do Not Contact`. |
| Activity outcomes | `Connected`, `No Answer`, `Voicemail`, `Busy`, `Callback Requested`, `Email Sent`, `Replied`, `Meeting Booked`, `Not Interested`, and `Other` are activity outcomes. `No Answer`, `Busy`, and `Voicemail` never make a contact method permanently incorrect. |
| Active focus | `Incorrect` and `Wrong Person` immediately move a contact method from the Sales Agent's active list into `Removed Contacts`. `Reception / Gatekeeper` moves to a secondary-contact area. `Do Not Contact` becomes globally restricted. |
| Undo and restoration | The Sales Agent receives a short immediate Undo opportunity after removing a contact method. After that, the Lead Generator, an in-scope Manager, or Admin may restore eligible methods. A normal Lead Generator cannot restore `Do Not Contact`; that requires an in-scope Manager or Admin. |
| No deletion | Removing a contact method never deletes it. The reason, actor, role, opportunity, assignment, timestamp, prior state, and resulting state remain in immutable history. |
| Reassignment review | Reassignment shows all methods removed by prior Sales Agents. Marketing selects which eligible methods to restore for the new owner. The default is to keep removed methods removed. The decision is stored per method and per new assignment. |
| Fresh-start safety | A fresh-start assignment may hide prior conversation details, but it never reactivates known incorrect, wrong-person, or DNC methods. Suppression and compliance state apply regardless of thread visibility. |
| Incorrect-lead threshold | Contact-method removal does not by itself count toward the three-agent incorrect-lead threshold. A current Sales Agent must explicitly submit one opportunity-level incorrect report. Three distinct reporters create one Admin review item and pause routing. |
| Role visibility | Sales sees its assigned lead and working contact list. The Lead Generator sees the complete contact-quality history for their marketing-owned lead. Managers see records inside their department/direct-report scope. Admin sees the complete workspace. |
| Xaviar boundary | Xaviar may analyze contact health, activities, follow-ups, restoration outcomes, reassignment, Connected outcomes, SQL progression, and explicit incorrect reports. It remains advisory and cannot restore, suppress, reassign, delete, or change a lead. |

## Dashboard consequence

Every dashboard and funnel must replace manual `Sales Acceptance` with evidence that can be derived from recorded work:

- assigned but not yet worked;
- time to first sales activity;
- first contact completed;
- successful connection;
- Sales Engagement;
- SQL conversion;
- follow-up completion.

The canonical definition is:

```text
Sales Engaged At = earliest(Connected activity time, SQL-entered time)
```

If neither event exists, the opportunity is not yet Sales Engaged. Logging a failed attempt counts as first work but not Sales Engagement.

## Implementation reference

The role flows, screen contract, database design, API behavior, Xaviar events, security rules, edge cases, and acceptance tests are defined in [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md).
