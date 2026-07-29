# Elevanta AI — Deployment Standard Operating Procedure

Status: Required deployment reference  
Last updated: 2026-07-29  
Applies to: Phase 1  
Product: Elevanta AI  
Source of truth: [CRM-PLAN.md](../CRM-PLAN.md), [CRM-DECISIONS-v1.1.md](../CRM-DECISIONS-v1.1.md), and [PROJECT-STATUS.md](../PROJECT-STATUS.md)

## 1. Purpose

This is the single operating procedure for deploying Elevanta AI. It keeps one clean deployment path, protects private lead data, and prevents duplicate Vercel projects or manual uploads from creating confusion.

## 2. Approved deployment architecture

| Area | Approved service | Rule |
|---|---|---|
| Source code and review | GitHub | Git is the only way application source moves between local development and deployment. |
| Web application and Node API | Vercel | Use one Vercel project connected to the GitHub repository. |
| Database, authentication, and file storage | Supabase | Use one approved Supabase project for Phase 1. |
| Production Vercel project | `elevanta-ai-pipeline` | Do not create a replacement project. Use the existing connected project: [Vercel project](https://vercel.com/charles-team3/elevanta-ai-pipeline/J6MU2WTFQbz7unh6itXmuNiqW9nj). |
| Public preview URL | Vercel-managed | The URL may change with Vercel. The production URL must be recorded in `PROJECT-STATUS.md` after confirmation. |

GitHub Pages is not used for the application. Phase 1 uses email/password authentication through Supabase Auth. No customer lead workbook or private contact data may be committed to GitHub.

## 3. One-project rule

1. Keep the existing `elevanta-ai-pipeline` Vercel project.
2. Connect it only to the `CharlesSmith999/elevanta-ai` GitHub repository.
3. Do not use Vercel’s manual folder upload or create another Vercel project for normal releases.
4. Deploy by pushing reviewed Git commits. Vercel creates preview deployments from non-production branches and production deployments from `main`.
5. If the current Vercel project is not connected to the repository, repair that connection rather than creating a new project.

## 4. Required access

Access is needed only by people performing the relevant job. Never place passwords, API keys, service-role keys, or tokens in this document, Git commits, chat messages, or screenshots.

| System | Required access | Why it is needed |
|---|---|---|
| GitHub repository | Administrator or write access | Push branches, open pull requests, review CI, and merge approved code. |
| Vercel project | Owner or project-member access | Confirm Git integration, set environment variables, read deployment logs, and control the production domain. |
| Supabase project | Owner or developer access | Apply source-controlled migrations, configure Auth, manage approved test users, and inspect database/security logs. |
| Elevanta AI production app | Shariq is initial admin | Review incorrect/duplicate queues and confirm first production setup. |

## 5. Environment-variable register

Set these values in Vercel. Keep the values secret. Add each variable to both Preview and Production only when the API and frontend need that environment.

| Variable | Used by | Purpose | Public? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Web app | Supabase project URL | Yes, but must point to the approved project. |
| `VITE_SUPABASE_ANON_KEY` | Web app | Supabase anonymous/public client key | Yes, but RLS must remain enabled. |
| `VITE_API_URL` | Web app | Base URL for the Elevanta Node API | Yes. |
| `SUPABASE_URL` | Node API | Supabase project URL | Yes, but server configuration only. |
| `SUPABASE_ANON_KEY` | Node API | Validates user sessions while using the caller’s access token | Treat as configuration; RLS still protects data. |
| `WEB_ORIGIN` | Node API | Exact allowed web origins, comma-separated | Yes. |
| `PORT` | Local API only | Local development port; Vercel supplies production routing | Yes. |

`SUPABASE_SERVICE_ROLE_KEY` must not be used by the normal user-facing API. If a future server-only import or admin task genuinely needs it, it must be implemented as a separate narrowly scoped function and approved before use.

## 6. Required first-time configuration

Complete these once, in this order:

1. Confirm the existing Vercel project is connected to `CharlesSmith999/elevanta-ai`.
2. Set `main` as the production branch and verify pull-request branches create previews.
3. Create or confirm the approved Supabase project.
4. Apply the committed migrations in `supabase/migrations/` in filename order. Do not create untracked SQL changes in the Supabase dashboard.
5. Configure Supabase Auth for email/password only; disable providers that are not approved.
6. Add the first workspace, Shariq’s administrator profile, and approved test accounts using a reviewed bootstrap process.
7. Configure the Vercel environment variables from Section 5.
8. Deploy from GitHub and verify the web application, API health endpoint, authentication, and role restrictions.
9. Record the verified project IDs, production URL, and completion date in `PROJECT-STATUS.md` without recording secrets.

## 7. Normal release process

### Release-frequency rule

Do not create a separate production deployment for every small edit. Group related, low-risk changes into one reviewed release when they do not need an urgent user-facing fix. Keep the work on a Git branch, let CI validate it, and merge to `main` only when the change is meaningful enough to release.

Examples of changes that may wait for the next planned release: wording, documentation, small visual polish, and internal refactoring with no production impact. Examples that should be released promptly: security fixes, broken user workflows, data-integrity fixes, approved milestone completion, or a required production configuration change.

This rule controls **production** releases. A Git-connected Vercel project may still create a safe preview for a branch push; never use a preview as a substitute for an approved production release.

### Before coding

1. Read `CRM-PLAN.md`, `CRM-DECISIONS-v1.1.md`, `PROJECT-STATUS.md`, and this SOP.
2. If the requested work differs from an approved decision, stop and ask permission before creating a new decision document version.
3. Keep the change on a named Git branch. Do not work directly on `main`.

### Before pushing

1. Confirm the working tree contains only the intended files.
2. Run the relevant tests: TypeScript check, domain tests, and production build.
3. Confirm no `.env` file, workbook, contact data, secret, or test credential is included.
4. Compare the change to the approved plan and decisions. Report any difference before pushing.
5. Commit with a clear message and push the branch to GitHub.

### Review and production deployment

1. Confirm GitHub CI is green.
2. Review the Vercel preview deployment.
3. Merge the approved pull request into `main`.
4. Let the existing Git-connected Vercel project deploy `main`.
5. Run the production acceptance checks below.
6. Update `PROJECT-STATUS.md` after the milestone or material deployment outcome.

## 8. Production acceptance checks

Every production deployment must confirm:

- The application loads without browser-console errors.
- The API health endpoint responds successfully once the API deployment is enabled.
- Email/password sign-in works for an approved test account.
- Sales agents cannot access leads outside their assignment scope.
- Managers see their team only; admins see the workspace.
- Status, note, follow-up, reassignment, and incorrect-review actions create audit history.
- Three different incorrect reports pause routing and create one admin review item.
- No production lead data is visible in public source code, browser storage, or unauthenticated pages.

## 9. Rollback procedure

1. If a deployment is unsafe, stop new releases and identify the last known good Git commit.
2. Revert the faulty commit through GitHub or locally with Git; do not make an untracked production-only code edit in Vercel.
3. Push the revert and let the existing Vercel project deploy it.
4. For a database migration issue, do not delete data. Create a reviewed forward-fix migration or restore through the approved Supabase recovery process.
5. Record the issue, rollback commit, and follow-up action in `PROJECT-STATUS.md`.

## 10. Current known deployment gaps

These must be resolved before Milestone 1 is marked complete:

- The local branch must be authenticated and pushed to GitHub.
- The GitHub CI workflow must complete one successful remote run.
- The existing Vercel project’s Git connection, branch settings, and environment variables must be verified.
- The new Vercel-compatible Node API catch-all entry point is committed at `api/[...path].ts`; it still needs one Git-connected preview deployment and a production health check.
- The real Supabase project must have the committed migrations, Auth configuration, administrator bootstrap, and production permission checks applied.
- The web app must change from browser-only sample data to real authenticated Supabase/API data in the next CRM-core milestone. This is intentionally not a full-workbook import yet.

## 11. Deployment record template

For each production release, add this compact entry to `PROJECT-STATUS.md`:

```text
Date:
Milestone:
Git commit:
Pull request:
Vercel deployment URL:
Database migration(s):
Validation result:
Rollback needed: Yes / No
Notes:
```
