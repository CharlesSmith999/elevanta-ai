# CRM Decisions v1.32: Read-only Gmail sync

Date: 2026-10-18
Status: Implemented locally; production migration and OAuth configuration not applied

- Connected Sales Agent Gmail mailboxes can be manually synchronized in read-only mode.
- The sync stores encrypted message content, thread metadata, and exact email-to-opportunity links.
- A message can link to multiple opportunities when the same contact email is shared across opportunities.
- Only exact contact-email matches are linked automatically. Uncertain matches are not attached.
- Sync is idempotent by connection and provider message ID.
- The sync does not send email, change status, change ownership, or create follow-ups.
- Existing central Gmail lead intake remains separate.

Implementation is tracked in [AGENT-EMAIL-SYNC-PLAN.md](./AGENT-EMAIL-SYNC-PLAN.md).
