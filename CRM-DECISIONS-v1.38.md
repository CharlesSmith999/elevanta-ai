# CRM Decisions v1.38: Context suggestion feedback

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- Sales Agents can accept or dismiss a context suggestion.
- Feedback is stored against the suggestion and can be used later to evaluate or improve the generator.
- Accepting a suggestion does not apply its status, follow-up, or next-action text to the CRM.
- Only the connected mailbox owner can submit feedback for that mailbox's suggestions.
- The current generator remains the deterministic `rules_v1` baseline until an approved AI provider is configured.
