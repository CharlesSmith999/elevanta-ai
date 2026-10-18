# CRM Decisions v1.41: Non-AI email workflow completion

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- The non-AI agent Gmail workflow now supports mailbox connection, read-only sync, exact email matching, unmatched review, safe link/ignore actions, linked context, rules-based suggestions, feedback, suggestion statistics, and searchable CRM lead selection.
- Agents no longer need to paste a lead UUID to resolve an unmatched email. They can search by lead name, email, or phone and select a result.
- Gemini integration and automatic AI generation are intentionally excluded from this milestone.
- No outbound email, automatic CRM status change, automatic follow-up, production deployment, or live migration is included.
