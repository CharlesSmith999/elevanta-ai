# Elevanta AI development environment

Date: 2026-10-18

## Isolation rule

All Gmail and Phase 2 work is isolated on the local branch `development/agent-email-phase2`.

- Production reference when this branch was created: `origin/main` at `55fb535`.
- Stage 1 was promoted through GitHub PRs #86 and #87. Production deployment commit: `df0699d`.
- Migrations `202610180004`, `202610180006`, `202610180008`, `202610180009`, and `202610180010` were applied to the live Supabase project on 2026-10-18. The live table check returned both `agent_gmail_connections` and `agent_email_sends`.
- The live Vercel feature flag `AGENT_GMAIL_SEND_ENABLED=true` is enabled. No production OAuth tokens or scheduler configuration were added.

## Change workflow

1. Build and test changes only on `development/agent-email-phase2`.
2. Update the relevant CRM decision record before proposing a release.
3. Run API and web typechecks plus repository whitespace validation.
4. Review the diff against `origin/main`.
5. Only after explicit approval, publish a selected commit or pull request and apply selected database migrations to production.

The live CRM remains unchanged while work stays on this branch.
