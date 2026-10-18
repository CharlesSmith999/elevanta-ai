# CRM Decisions v1.33: Agent Gmail background worker

Date: 2026-10-18
Status: Implemented locally; scheduler not enabled

- A protected internal worker endpoint now processes enabled Sales Agent Gmail connections.
- The worker uses the existing scheduler secret validation and the same lease/idempotency rules as manual sync.
- No cron job is added or enabled by this change.
- Production scheduling requires the Agent Gmail callback configuration, migration, and a safe mailbox pilot to be verified first.
- The worker remains read-only and cannot send email or alter lead status, ownership, or follow-ups.
