# CRM Decisions v1.29: Sales agent email sync boundaries

Date: 2026-10-18
Status: Phase 0 approved; no production implementation yet

- Sales-agent mailbox synchronization is a separate feature from the existing central Gmail lead-intake connector.
- Phase 1 is read-only and additive. It must not send email, change lead status, change ownership, or create follow-ups automatically.
- OAuth is required. Mailbox passwords must never be stored.
- Email matching must use provider message/thread identifiers and confidence rules. Uncertain matches go to review.
- Existing lead, assignment, incorrect-review, dashboard, and calling behavior remains unchanged.
- Outbound drafts and sequences are deferred to later phases and require separate approval after read-only evidence is successful.
- The first provider must be selected before Phase 1 OAuth implementation.

Full implementation and risk controls are documented in [AGENT-EMAIL-SYNC-PLAN.md](./AGENT-EMAIL-SYNC-PLAN.md).
