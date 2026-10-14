# Sales Workbench

Approved scope: [CRM-DECISIONS-v1.18.md](../CRM-DECISIONS-v1.18.md). This extends the Phase 1 CRM core and screen-refinement work in [CRM-PLAN.md](../CRM-PLAN.md).

## Agent workflow

Open Leads as a Sales Agent. Assigned leads appear beside the current working panel. Search by name/contact/source or filter by source, status, open leads, or overdue follow-ups. The queue shows 40 records per page.

- Phone/contact values and copy/call shortcuts are visible without opening full details.
- Call, WhatsApp, and email links open external apps. They do not send messages, initiate server-side calls, or record successful contact.
- WhatsApp requires an explicit international prefix. Masked/malformed contacts receive no links. Removed, incorrect, wrong-person, DNC, duplicate/restricted and routing-paused contacts/leads cannot be contacted through these shortcuts.
- Save status/qualification separately. Existing Won amounts, loss reasons, and Sales/Marketing qualification ownership remain enforced.
- Record an activity, outcome, notes and optional future follow-up. Note-only saves are supported. Save and Next advances only after a confirmed save and refresh.
- Pending progress changes block Save and Next. Unsaved drafts prompt before navigation. Failed writes retain the draft; confirmed writes followed by a failed refresh clear the submitted draft and require a read-only refresh before further saves.
- Filtering never silently discards the open draft. Full details remains available for contact maintenance, incorrect reports and other existing controls.

## Security and compatibility

No database migration, permission expansion or outbound integration is included. Existing authenticated API requests and database row policies remain the authority. Both the parent screen and workbench enforce assignment scope. Fresh-start history excludes previous assignment activity. Admin preview of a Sales account is read-only for saving work.

The global lead list does not join contact inventory. Workbench contact health/focus and global restriction flags load in a bounded authenticated request for at most 41 opportunity IDs (40 visible rows plus the pinned lead), under existing row policies. Missing health inventory on a real CRM record fails closed. Single-lead refresh includes contact inventory. The workbench uses the existing activity, note and status endpoints.

As with other network writes, a lost response can be ambiguous. The UI warns the agent to inspect history before retrying. This release does not claim new server-side idempotency for activity writes.

## Verification: October 13, 2026

The isolated release excludes unrelated local dashboard/import changes.

- 137 application tests passed after the loading correction, including five focused workbench tests and the bounded-query regression.
- Web and API TypeScript checks passed.
- Web production build passed with the existing large-bundle warning.
- Synthetic browser acceptance passed: assignment list/panel, blocked contact links, fresh-start history, unsaved navigation/filter protection, activity with follow-up, Save and Next, Won amount validation, last-record behavior, and mobile width.
- Intercepted API browser checks passed: failed saves retain drafts; successful saves with failed refresh cannot be duplicated by Refresh; no uncaught browser errors.
- Desktop and mobile screenshots were inspected.

Run browser acceptance against a local Vite server with `WORKBENCH_TEST_URL` and optional `PLAYWRIGHT_MODULE`. The script rejects non-local targets and uses only synthetic contacts. It never signs into production or sends outreach.

PR #68 passed CI run 369 and was deployed as commit `58ef539af3a2cba99a928b32f9a06fbad92f2a22`. Live verification caught a database timeout from loading contact inventory across the entire historical dataset.

PR #69 passed CI run 371 and removed the global join. Production commit `08cce47df7ddc774db61e34133af4ed9335d1581` deployed successfully in Vercel deployment `C7mondwHehBepdGjaCyPkiSAcGsD`. Live read-only acceptance confirmed Asad's 692 assigned leads, visible contact values, 26 call links and 41 copy buttons on the inspected page/pinned record, blocked outreach on an Incorrect record, and disabled saves during Admin role preview. These counts are a point-in-time acceptance observation, not a fixed business total.

The API health check returned OK. One initial workspace load still required Retry connection before succeeding; further startup performance investigation remains a follow-up. Successful writes and failure recovery were tested with synthetic data and intercepted API responses, not by changing production leads. No production leads were edited, deleted or contacted during verification.
