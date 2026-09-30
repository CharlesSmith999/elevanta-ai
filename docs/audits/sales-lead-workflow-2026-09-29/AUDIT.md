# Sales Lead Workflow UX Audit

Date: 2026-09-29

Scope: Live Sales Agent Lead Inbox, lead overview, activity logging, activity history, and mobile behavior.

## Executive assessment

The workflow works, but it is organized around stored lead fields rather than the Sales Agent's next decision. The Sales Agent should be able to answer three questions immediately:

1. Which lead needs my attention first?
2. Who should I contact and what happened last time?
3. What should I do next and when?

The current experience does not answer those questions quickly enough.

## Journey health

1. **Open the Lead Inbox: Needs improvement**
   - The inbox uses only part of the desktop width.
   - The Owner column repeats the current Sales Agent on every row.
   - Lead rows do not show the latest outcome, last activity, contact readiness, or urgency clearly.
   - Completed and inactive leads compete with actionable work.

2. **Choose the next lead: Needs improvement**
   - Queue filters exist, but each row gives too little information to judge priority.
   - Most rows show `No follow-up`, which means the queue cannot guide the agent reliably.
   - There is no strong primary action on a row.

3. **Understand an opened lead: Needs improvement**
   - Contact methods are prominent, but the next action and latest context are not.
   - Adding a phone or email is more visually prominent than contacting the lead.
   - Phone numbers are not formatted and email text can be truncated.
   - `Unverified` appears twice for the same contact method.
   - The page does not immediately show the last outcome, lead age, follow-up due time, or handoff summary.

4. **Log an activity: Needs improvement**
   - The form is short, but `Connected` is preselected. This can create an incorrect record if the agent saves too quickly.
   - The agent cannot schedule the next follow-up in the same flow.
   - Outcomes are not optimized as quick selections and do not reveal outcome-specific fields.

5. **Review lead history: Needs improvement**
   - The history shows event text and time, but not enough context.
   - It should show actor, channel, contact method, outcome, note, stage change, and scheduled next step.

6. **Use the workflow on mobile: Poor**
   - The role switcher, theme controls, floating menu, and notification bell consume or cover important space.
   - The first mobile screen shows contact administration before the agent's next action.
   - Primary actions are not available as a persistent mobile action bar.

## Recommended redesign

### 1. Lead Inbox becomes a personal work queue

Top summary:

- New assignments
- Due today
- Overdue
- Waiting for reply

Default view: `Needs action`, sorted by follow-up urgency and then assignment age.

Each lead row should show:

- Name, project type, and source
- Lifecycle stage
- Best available phone and email indicators
- Latest activity and outcome
- Next action and due time
- Urgency label
- One clear `Open lead` action

For a Sales Agent, remove the Owner column because it repeats information they already know. Use the recovered width for last activity and next action. Keep Owner visible for managers and admins.

### 2. Lead Workspace uses an action-first hierarchy

Recommended order:

1. Compact identity header: lead, project, source, lifecycle, assigned date, and marketer handoff.
2. Action Center: next action, due time, primary contact, and `Log activity` or `Schedule follow-up`.
3. Active contact methods: primary contacts first, then unverified contacts, then removed contacts in a collapsed section.
4. Latest interaction: outcome, notes, actor, and next step.
5. Project details and complete activity history.

`Add phone or email` should become a secondary action. It is useful, but it is not normally the first job for a Sales Agent.

### 3. Activity logging combines outcome and follow-up

The form should include:

- Contact method
- Activity type
- Outcome with no preselected value
- Short note
- Next follow-up date and time
- Follow-up purpose

Use outcome-specific behavior:

- No answer or voicemail: suggest a follow-up.
- Connected: suggest the appropriate lifecycle change.
- Meeting booked: require meeting date and time.
- Not interested or lost: require a reason.
- Incorrect contact: update that contact method, not the whole lead.

Save the activity and next follow-up together so the lead never has an activity without its intended next step.

### 4. Activity History becomes a readable timeline

Each entry should show:

- Date and time
- Agent
- Channel and contact method
- Outcome
- Notes
- Lifecycle change
- Next follow-up

Group entries by day and keep the newest event first. Add filters for calls, SMS, email, notes, and lifecycle changes.

### 5. Mobile becomes task-first

- Put identity, next action, and the primary contact in the first viewport.
- Use a sticky bottom bar with `Call`, `Log`, and `Follow-up`.
- Move the bell into the header notification area.
- Replace the floating menu with a compact header control that does not cover content.
- Keep contact administration and full history below the immediate work area.

## Recommended development order

1. Redesign Lead Inbox information hierarchy and role-aware columns.
2. Redesign the Lead Workspace around the Action Center.
3. Combine activity logging and follow-up scheduling.
4. Upgrade the activity timeline.
5. Complete mobile-specific layout and interaction testing.

## Evidence

## Implemented result, September 30, 2026

The approved redesign is implemented locally.

- Lead Inbox is now a personal action queue instead of a generic table.
- Lead Workspace begins with the next best action and primary contact.
- Activity outcome is no longer preselected.
- Activity and optional follow-up are saved through the existing combined workflow.
- Removed contact methods remain visible for audit in a separate collapsed section.
- Mobile uses a persistent Contact, Log, and Follow-up action bar.
- Desktop, 390 px mobile, light mode, and dark mode visual checks passed.
- The 93-test regression suite, TypeScript check, production build, and repository whitespace check passed.

The implementation did not require a schema change and did not mutate any lead record during visual verification.

- `01-lead-inbox.png`
- `02-lead-detail-overview.png`
- `03-log-activity.png`
- `04-activity-history.png`
- `05-mobile-lead-detail.png`
- `06-mobile-lead-inbox.png`

No production lead data was changed during this audit.
