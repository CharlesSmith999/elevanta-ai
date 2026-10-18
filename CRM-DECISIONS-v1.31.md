# CRM Decisions v1.31: Gmail sync foundation

Date: 2026-10-18
Status: Phase 1b implemented locally; production migration and OAuth configuration not applied

- Phase 1a adds isolated tables for Sales Agent Gmail connections, OAuth state, threads, messages, lead links, and sync runs.
- The migration is additive and does not alter the existing central Gmail intake connector or any lead tables.
- All new tables are workspace-scoped, protected by row-level security, and writable only through the service role during the next implementation step.
- Raw email body storage is encrypted at rest at the application layer; outbound sending is not represented in this schema.
- Production application requires migration review and a separate release approval.
- The local Phase 1b implementation adds agent-only Gmail status, mailbox save, OAuth start/callback, and disconnect routes plus a Sales Agent My profile form. It does not run synchronization yet.

Migration: `supabase/migrations/202610180004_agent_gmail_sync_foundation.sql`
