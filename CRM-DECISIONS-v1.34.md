# CRM Decisions v1.34: Agent email match review queue

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- Agent Gmail sync stores an unmatched message in `agent_email_match_reviews` instead of attaching it to a lead automatically.
- A message is placed in the queue when no exact contact email match is found. The message remains available for audit and is not treated as a CRM activity on any opportunity.
- The queue displays the subject, sender, candidate email addresses, and message date on the Sales Agent My profile page.
- Matching remains conservative: exact contact email matches continue to link automatically, and one contact email may link to multiple opportunities when the CRM already contains those opportunities.
- This milestone does not add automatic linking, sending, status changes, ownership changes, or follow-up creation.
- The additive migration is `supabase/migrations/202610180006_agent_email_match_review.sql`.
- Production is intentionally unchanged. Applying the migration, enabling OAuth configuration, and scheduling sync require a separate reviewed release.

## Acceptance checks

- Unmatched messages are visible to the owning Sales Agent as pending review.
- Existing matched-message behavior is unchanged.
- A duplicate sync does not create a second review row for the same provider message.
- Review rows are workspace-scoped and service-role-only at the database layer.
