# Elevanta AI development environment

Date: 2026-10-18

## Isolation rule

All Gmail and Phase 2 work is isolated on the local branch `development/agent-email-phase2`.

- Production reference: `origin/main` at `55fb535` when this branch was created.
- Development head: the local Stage 1 manual-email implementation commit (after validation).
- No commits from this branch have been deployed to Vercel.
- No migrations from this branch have been applied to the live Supabase project.
- No production OAuth credentials, Gmail tokens, or scheduler configuration are stored in this branch.

## Change workflow

1. Build and test changes only on `development/agent-email-phase2`.
2. Update the relevant CRM decision record before proposing a release.
3. Run API and web typechecks plus repository whitespace validation.
4. Review the diff against `origin/main`.
5. Only after explicit approval, publish a selected commit or pull request and apply selected database migrations to production.

The live CRM remains unchanged while work stays on this branch.
