# CRM Decisions v1.42: Stage 1 manual email sending

Date: 2026-10-18
Status: Deployed to production on 2026-10-18; Gmail sending remains agent-connection dependent

- Stage 1 includes one-message-at-a-time, agent-approved email sending from the Sales Agent's connected Gmail account.
- The recipient must match the lead email stored in CRM, and only the current assigned Sales Agent may send.
- Incorrect, duplicate, and Do Not Contact leads are blocked. Every attempt is audited as pending, sent, or failed.
- Sent messages are stored as outbound email context and as an `email_sent` activity on the lead timeline.
- Gmail sending is protected by the `AGENT_GMAIL_SEND_ENABLED=true` environment flag and requires a fresh OAuth consent for the Gmail send scope.
- Reply threading is supported when a stored message header is supplied, but automated sequences, scheduled sending, bulk sending, templates, AI, and automatic follow-ups are out of scope.
- Code is deployed from production commit `df0699d`. The additive Gmail tables were applied to the live Supabase project and the production feature flag is enabled. No production lead records were changed. Agents must reconnect Gmail to grant the send scope before using outbound email.
