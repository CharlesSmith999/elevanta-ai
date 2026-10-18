# CRM Decisions v1.36: Linked email context

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- Sales Agents can view recent messages that are already linked to their CRM opportunities from My Profile.
- Context is read-only and limited to messages belonging to the agent's connected mailbox with an active CRM opportunity link.
- Message bodies are decrypted only in the protected API response for the mailbox owner and are truncated to a safe display length.
- Unmatched or ignored messages are not shown in linked context.
- No AI-generated status, follow-up, ownership, or outbound email action is introduced yet. This is the Phase 2 context foundation for later recommendations.

The release remains local. Production migration, OAuth configuration, and scheduling still require a separate reviewed release.
