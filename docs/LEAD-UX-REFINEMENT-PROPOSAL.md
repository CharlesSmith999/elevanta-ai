# Lead and research UX refinement

Status: approved for implementation by the product owner. Implementation and verification in progress.
Date: 2026-09-25
References: ../CRM-PLAN.md, ../LEAD-WORKFLOW-SPEC-v1.0.md, ../CRM-DECISIONS-v1.14.md.

## Current observations

Inspected the live Lead Inbox, creation dialog, lead overview, Research Queue, and a ready research item through the signed-in Admin view. The viewport was narrow. This is a scoped review, not verification of every role, desktop layout, keyboard path, or both themes.

- The lead list starts below substantial header, workspace information, and filter content.
- The creation dialog exposes all three form sections in a long scroll. It accepts only one phone and one email initially and asks the user to add further methods later.
- A long description appears before active phone/email methods in the lead overview.
- Lead detail navigation retained a scrolled position during the review; the fixed Menu control overlapped page content.
- Research settings occupy the top of the Admin queue, ahead of operational work.
- Research has separate phone/email inputs and a handoff preview, which should be preserved.
- Save research and Assign and send to Sales have similarly prominent treatments on the same long screen.
- While research data loaded, the UI temporarily displayed Not connected and zero items, then resolved to enabled intake and populated items. Loading must not be presented as a confirmed disconnected or empty state.

## Role priorities

Marketing: identify the request, find usable contact information, qualify as MQL when appropriate, assign, and monitor Sales progress.
Sales: see assigned leads needing attention, find usable contacts, record an outcome, and schedule the next action. No MQL or reassignment controls for Sales Agents.
Managers: see ownership, stalled work, overdue follow-ups, contact quality, and intervene within existing scope.
Admin: the same operational overview plus separate connection/settings and audit access.

## 1. Add lead entry point

One consistent Add lead action in the Leads page header for authorized roles. Retain a clear route from Marketing's workspace. Do not display a create action to Sales Agents. Open a focused form and restore focus to the trigger on close.

## 2. Lead creation form

Use two steps, retaining entered values when moving backward:

1. Lead details: name, repeatable phone and email rows, source, category, and short project description. Put optional additional information in an expandable section. Require name plus at least one usable phone or email under existing rules. Show duplicates and invalid values beside affected fields.
2. Review and route: compact preview, eligible Sales Agent selection, and existing Marketing qualification controls. Primary action Create and assign; secondary Save unassigned. Explain these different outcomes. Prevent repeat submission and retain entries on failure.

Name the primary action for the actual outcome; do not imply assignment when saving unassigned. Marketing identity and system timestamps come from the current session/server.

## 3. Leads list and detail

Compact header, search, and role-specific quick filters above results; put less-used filters in an expandable panel.

Sales quick filters: Needs first contact, Due today, Overdue, All assigned. Rows show identity, stage, latest outcome, next follow-up, and source. Default ordering should make urgent work easy to find, with an explicit sort control.

Marketing rows emphasize identity, assigned agent, Sales progress, contact quality, and last activity. Manager/Admin views include owner/team filters within current permissions.

Opening a lead starts at its header. Default Overview order: identity and stage; next follow-up; active phone/email methods; short request summary; latest activity. Full request details expand on demand. Full history is a separate tab. Removed methods remain collapsed and auditable.

Sales primary action: Log activity, opening a focused drawer with activity type, contact method, outcome, note, and optional next follow-up. Contact-health marking remains available separately. Marketing sees Sales progress and its permitted qualification/reassignment actions, not a disabled Sales form.

## 4. Research list and workspace

Queue first: compact search, New/Researching/Ready for Sales/Sent to Sales views, additional filters, and results. These are views over existing statuses, not a replacement status model. Rows show name, request/category, location when available, age, usable contacts, and research state.

Keep the shared Marketing queue and no-claim policy. Sales cannot access research. Put Admin mailbox controls behind an Admin-only settings entry, with a small accurate health indicator if needed. Render Loading until connection state is known.

Research detail has two task tabs: Original request and Research & contacts. Keep enough request context visible while editing. Research & contacts prioritizes name, separate repeatable phone/email controls, handoff summary, and optional evidence. Original masked values remain distinguishable and preserved. Internal evidence remains restricted.

Save research is available without publishing. Concurrent edits must preserve drafts and explain conflicts. Display who last updated the item when existing data supports it.

## 5. Research handoff

Send to Sales opens a dedicated review drawer containing name, category/source, usable phone/email methods, project context, handoff summary, and eligible Sales Agent selection. Explain missing prerequisites and duplicate blockers beside the relevant item.

Final action: Assign and send. Commit the handoff once, retain data on failure, and show a specific success message naming the receiving agent, with Open lead and Back to research actions. No Sales acceptance step. Sent items link to the existing lead and cannot publish another one.

## Acceptance criteria

- Same fields and hierarchy in light/dark mode; responsive layouts and readable focus/error states.
- Primary actions stay reachable without covering content on narrow screens.
- Multiple phones/emails can be entered during creation without reopening the lead.
- Research publication preserves approved context and makes the lead visible to the selected Sales Agent under existing permissions.
- UI role restrictions agree with backend authorization.
- No false disconnected/empty state during loading; no accidental submission or lost draft on validation/network failure.
- Existing audit history, DNC protection, duplicate rules, and one-active-owner rule remain intact.

## Delivery sequence

Confirm this screen contract; produce a reviewable visual preview; update decision/plan references for approved changes; implement shared form and detail components; verify creation, research save, handoff, assigned-agent visibility, and mobile/theme behavior; deploy using the existing deployment SOP when authorized.
