# Elevanta AI: Sales Workbench v1.18

Status: Approved by the product owner in chat on 2026-10-12: “just implement this in the project”.

This extends the existing Phase 1 lead workspace. The owner approved the proposed single-screen workflow in response to Asad's feedback.

- Sales agents receive an assigned-lead list and a working panel on the same screen. The primary contact is visible in the list with copy/call shortcuts; all methods remain selectable in the panel.
- Call, WhatsApp, and email links open external applications. Opening a link must never create an activity or claim a completed call/message. WhatsApp links require an explicit international country code; do not guess it from historical numbers.
- Preserve contact health, removed-method and DNC restrictions, role visibility, and fresh-start history limits. No permission or database policy changes are authorized by this refinement.
- Agents can save status/qualification progress, with the existing Won financial and Lost reason requirements, separately from recording an activity and its optional follow-up. Save and Next advances only after the activity is confirmed and refreshed; pending progress changes must first be saved or discarded.
- Warn before leaving unsaved work, block navigation during saves, keep failed-save drafts, and avoid resubmitting a successful write when its subsequent refresh fails.
- Existing full details remain available for contact maintenance and incorrect-lead flags. Automated outbound integrations remain Phase 2.

Implementation and verification: [Sales Workbench](docs/SALES-WORKBENCH.md).
