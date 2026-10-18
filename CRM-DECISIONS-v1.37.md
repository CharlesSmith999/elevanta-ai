# CRM Decisions v1.37: Reviewable email context suggestions

Date: 2026-10-18
Status: Implemented locally; production migration not applied

- Sales Agents can request a context suggestion for a linked email message.
- The current local generator is a deterministic rules baseline (`rules_v1`), not an external AI model. It identifies broad intent, possible objection words, a short summary, and a suggested next action.
- Suggestions are stored with a version, evidence summary, and pending state for later feedback and model replacement.
- Suggestions never change lead status, qualification, ownership, follow-up dates, or send email automatically.
- Only the connected mailbox owner can generate suggestions for linked messages.

The release remains local. An approved AI provider, model, retention policy, and production migration are still required before calling this AI-generated output.
