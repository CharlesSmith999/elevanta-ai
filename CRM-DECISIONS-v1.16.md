# Elevanta AI: Historical import decisions v1.16

Status: Approved by product owner in chat on 2026-10-07.

This extends the existing decisions for the Milestone 5 historical workbook import only. Ordinary CRM entry, role permissions, Gmail intake, and Phase 2 boundaries do not change.

## Preservation and validation

- Preserve every accepted source record, its original values, workbook/tab/row provenance, and linked Master/source copies. A repeated source copy is not a second opportunity.
- Stage data before activation. Counts must reconcile and retries must not add duplicate records. Preserve unresolved records in an Admin-only import review area, outside normal Sales routing.
- Preserve original statuses including `Not available` and `No Answer`. Never relabel missing status as New or treat No Answer as incorrect contact information. Unsupported historical labels remain visible and need an explicit mapping before activation.
- Preserve missing financial values, reasons, and timestamps as missing. Historical Won/Lost records may lack information required for new CRM entries. Do not fabricate revenue, loss reasons, transition dates, Sales activity, or three independent incorrect reports to satisfy live-entry validation.
- The default source date is `2025-08-01` only where the approved normalization rule requires it. Record the date basis. A source date is not proof of a call, qualification, win, or follow-up event.
- Keep MQL/SQL, sales outcome, contact quality, and lifecycle status separate. Conflicts require review, not an arbitrary winner.
- Shared phone/email keys produce comparison groups. Never automatically merge contacts or choose the current Sales owner for an unresolved ownership group.
- Historical notes and all usable contact methods remain preserved. Do not truncate data silently to fit ordinary form limits.

## Ownership and access

- One active Sales owner per opportunity. Managers may own the approved legacy manager-assigned leads; this does not grant agents wider visibility.
- Approved workbook mapping uses the named team and its manager hierarchy. The owner approved reuse of the existing Ali, Owais, and Muzammil accounts. Do not assign to both an old and a new account for the same person.
- Missing or ambiguous user mapping blocks activation for that record, not preservation in staging.
- Import management is initially Admin-only and workspace-scoped. No service-role bypass for routine lead operations. Private workbooks, raw contacts, and credentials must never enter public Git.

## Cutover

- Do not activate unresolved records. Retain the 18 ownership-combination batches and exception-group structure for efficient review.
- Do not delete all existing leads. Identify an exact disposable test set, back it up, and verify replacement counts before removing it. Preserve genuine CRM and Gmail/research data and all staff accounts.
- Stage, validate, activate, reconcile, and retire test data are separate outcomes. Report each honestly. A successful staging upload is not a completed operational migration.
- Preserve strict live-entry rules for newly recorded CRM work. Label imported history and do not use invented historical events for coaching or response-time metrics.

Implementation status belongs in PROJECT-STATUS.md, not in this approved decision record.
