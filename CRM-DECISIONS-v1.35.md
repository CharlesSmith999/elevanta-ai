# CRM Decisions v1.35: Resolve agent email reviews

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- Sales Agents can mark a pending unmatched email as ignored or link it to a selected CRM opportunity.
- Linking requires the CRM opportunity UUID and verifies that the opportunity and review belong to the same workspace and mailbox owner.
- A manual link is recorded with confidence 80 and reason `manual_review`; it does not change lead status, ownership, follow-ups, or the email body.
- Ignoring records the reviewer and timestamp without deleting the message.
- Only the Sales Agent who owns the connected mailbox can resolve its review rows.
- No outbound email capability is introduced.

The release remains local. Production migration, OAuth configuration, and scheduling still require a separate reviewed release.
