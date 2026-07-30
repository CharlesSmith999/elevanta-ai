# Elevanta AI — Project Status

Status owner: Codex with Shariq  
Last updated: 2026-07-30
Source of truth: [CRM-PLAN.md](./CRM-PLAN.md), [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md), [DASHBOARD-DATA-DICTIONARY.md](./DASHBOARD-DATA-DICTIONARY.md), [DASHBOARD-COMPLETION-PLAN.md](./DASHBOARD-COMPLETION-PLAN.md), [UI-REFINEMENT-LOG.md](./docs/UI-REFINEMENT-LOG.md), [CRM-DECISIONS-v1.1.md](./CRM-DECISIONS-v1.1.md), [CRM-DECISIONS-v1.2.md](./CRM-DECISIONS-v1.2.md), [CRM-DECISIONS-v1.3.md](./CRM-DECISIONS-v1.3.md), [CRM-DECISIONS-v1.4.md](./CRM-DECISIONS-v1.4.md), and [XAVIAR-EVALUATION-PLAN.md](./XAVIAR-EVALUATION-PLAN.md)

## Current position

Elevanta AI has a working Phase 1 CRM foundation released on `main`. Production authentication and the safe sample-data workspace are live and verified; real lead-data migration remains deferred to Milestone 5.

The full Excel workbook has **not** been imported into the active CRM yet, by deliberate decision. The current public preview uses safe sample data in the browser so the workflow can be tested without exposing private lead data. **Real lead-data migration is a Milestone 5 activity only, after Xaviar development and safety review; it is not a Milestone 1 release requirement and must not be requested again during Milestones 1–4.**

Step 2 dashboard data-model implementation is complete and verified: approved source labels, source validation, Won financial fields, automatic won dates, source filters groundwork, and form validation are implemented. Migration `202607290003_dashboard_data_definitions.sql` is applied and verified in Supabase project `jayxyikgefnzitxcbdov`.

Step 3 opportunity-history and stage-duration work is implemented, deployed, and verified. Migration `202607290004_opportunity_stage_history.sql` stores every stage entry/exit and provides reassignment-aware ownership intervals in Supabase.

Steps 4 and 5 are implemented and deployed: the test dashboard now has daily, weekly, monthly, yearly, lifetime, and custom lead-date filters plus an approved-source filter. Admin, manager, sales-agent, and marketer views now receive role-aware graphs and a separate source breakdown.

The first dashboard foundation is deployed: the manager/admin Benchmark Board keeps source metrics separate and marks cohort rules as open; the manager/admin Leaderboard includes sample-size and privacy safeguards; the admin Data Quality view reports exceptions and reconciliation. The role-dashboard audit on 2026-07-29 found missing department-manager, marketing, agent-leaderboard, loss-analysis, response-speed, routing, acceptance, and revenue views.

The dashboard-completion implementation is released in pull request [#7](https://github.com/CharlesSmith999/elevanta-ai/pull/7) under [DASHBOARD-COMPLETION-PLAN.md](./DASHBOARD-COMPLETION-PLAN.md): Admin company/marketing/sales contexts, sales-manager and individual role views, marketing quality scorecards, response and routing speed, loss reasons, Won financial metrics, role-safe status/team-member filters, marketing and sales leaderboards, private individual standings, and role-appropriate charts are implemented. Safe-fixture role smoke checks, TypeScript checks, production build, and 19 domain/permission/dashboard tests passed. GitHub Actions run 135 passed, and the release is merged to `main` and deployed to Vercel. The pre-Xaviar UI refinement implementation is now complete and recorded in [UI-REFINEMENT-LOG.md](./docs/UI-REFINEMENT-LOG.md); only Shariq's explicit Phase 1 screen/field-contract approval remains before Xaviar work begins.

Project-type reporting remains `Not available` until the CRM form has an approved controlled project-type dictionary and actual recorded values. This prevents a misleading filter made from invented categories.

Steps 11–12 are complete and deployed: the Node/React architecture and API implementation record is documented in `docs/ARCHITECTURE-API-IMPLEMENTATION.md`; the API has typed validation, role-safe dashboard routes, contact/opportunity and activity aliases, Admin review routes, Won financial fields, and safe deferred responses for imports and Xaviar coaching. Production API `/api/health` returned `{"service":"elevanta-api","status":"ok","phase":1}` with HTTP 200.

## Milestone tracker

| Milestone | Status | Evidence / current result | Remaining work |
|---|---|---|---|
| 0 — Planning and validation | Complete | Product name, Xaviar, roles, lifecycle, reassignment history, incorrect-review rule, dashboard requirements, import rules, and Phase 1 boundaries are documented and approved. | Confirm the remaining open decisions when implementation reaches them. |
| 1 — Foundation | Complete | React/Vite web app, Node API, Supabase foundation tables, reconciled CRM control routines, role/manager model, audit-oriented workflow functions, protected lead actions, test accounts, GitHub CI workflow, Vercel catch-all API entry point, typed API contracts, role-safe dashboard routes, and Supabase email/password sign-in are released on `main`. Production build and signed-in smoke testing passed. | No product release work remains. Migration-ledger traceability is a documented follow-up before Milestone 5, not a reason to import data now. |
| 2 — CRM core | Complete | Contact/opportunity views, assignment history, full-context/fresh-start handoff, statuses, notes, follow-ups, incorrect-review actions, role-aware visibility, and audited follow-up completion are implemented against the authenticated API. CI run 135, local 19-test suite, production build, and signed-in production smoke passed. | No Milestone 2 product work remains. Real Excel lead-data migration remains deferred until after Milestone 4. |
| 3 — Controls and dashboards | Complete / released | PR [#7](https://github.com/CharlesSmith999/elevanta-ai/pull/7) implements and releases the approved role-specific dashboards, graph families, loss/revenue/routing/response metrics, status/team-member filters, source-aware reporting, and privacy-safe leaderboards. GitHub Actions run 135 passed and Vercel production is Ready. Benchmark cohort rules remain intentionally open for Xaviar evaluation. | No technical dashboard work remains; UI refinement is complete, pending Shariq's screen/field-contract approval. |
| 4 — AI support | Planned phased build | Xaviar will be built and validated in sub-phases 4A–4H using synthetic or safe sample data: data contract, event foundation, explanations, recommendations, coaching, benchmarks, calibrated predictions, dashboard integration, and safety review. | Complete all sub-phases and obtain manager/admin sign-off; no live agent rollout occurs in this milestone. |
| 5 — Production data migration | Not started | Deliberately deferred until Milestones 2–4 and Xaviar safety review are complete. | Stage and validate the approved Excel data, preserve provenance, apply duplicate handling, reconcile dashboards, activate migrated records, and then begin live agent/marketer use. |
| Phase 2 — Workflow automation | Not started | Scope is documented only. | Email, SMS, calendar, phone, digests, escalation, consent enforcement, and human approval gates. |
| Phase 3 — SaaS product | Not started | Scope is documented only. | Multi-tenancy, billing, self-service administration, onboarding, limits, and product analytics. |

## Deployment and repository state

- Live preview: [elevanta-ai-pipeline.vercel.app](https://elevanta-ai-pipeline.vercel.app)
- Hosting decision: Vercel for web/API, Supabase for database/auth/storage.
- Supabase project: `elevanta-ai` is reachable and reports Healthy in the console. Direct SQL verification confirmed all seven foundation tables (`workspaces`, `profiles`, `contacts`, `opportunities`, `source_dictionary`, `opportunity_stage_history`, and `opportunity_stage_ownership_periods`) exist. A safe idempotent reconciliation has restored the three missing controls (`set_opportunity_status`, `validate_source_label`, and `touch_updated_at`); the expected public control routines are present. The internal migration ledger is absent (`to_regclass('supabase_migrations.schema_migrations')` returned `NULL`), so traceability is a follow-up to complete before Milestone 5. Only sample records are currently intended.
- Production branch: `main`.
- Production release commits: `61e7eff Complete dashboard readiness and API foundation`; `3511189 Fix Vercel API ESM loading`; `6d8ba91 Fix CRM API 404 on Vercel`.
- Release PRs: [#5](https://github.com/CharlesSmith999/elevanta-ai/pull/5) released the foundation/authentication gate; [#6](https://github.com/CharlesSmith999/elevanta-ai/pull/6) fixed the production domain-model build. Both are merged to `main`.
- GitHub publishing: complete through the authorized ChatGPT Codex Connector, restricted to `CharlesSmith999/elevanta-ai`.
- Deployment procedure: [DEPLOYMENT-SOP.md](./docs/DEPLOYMENT-SOP.md) is the required reference for all releases; it uses the existing Git-connected Vercel project and forbids duplicate deployment instances.
- API deployment path: `api/[...path].ts` now routes Vercel `/api/*` requests into the shared Node API without creating a second service.
- Latest release validation: Vercel production deployment for `89bc441` is Ready. Production `/api/v1/*` CRM routing is explicitly served by a dedicated Vercel catch-all, and the verified Supabase database state includes `profiles.department` plus the authenticated read grants governed by existing Row Level Security policies. A fresh signed-in dashboard check confirms zero CRM connection errors.

## Validation completed

- TypeScript checks pass.
- Production web build passes.
- Domain tests were previously verified successfully for the CRM rules.
- Step 2 Supabase verification passed: all 10 approved source labels exist in `source_dictionary`; `opportunities` contains `total_project_cost`, `upfront_payment_amount`, and `won_at`; the foundational CRM tables are present.
- Steps 6–10 local readiness verification passed: 16 domain/permission/reconciliation tests, TypeScript checks, and production build.
- Steps 11–12 local API verification passed: API typecheck/build and `/health` smoke test.
- Release verification passed: PR #7 merged to `main`; CI run 135 succeeded; the Vercel deployment for commit `47ec7a4d383c72a67586c9e5013afa1839bcc0ca` is Ready; production `/api/health` was observed in Vercel runtime logs with a successful 304 response.
- Supabase Step 3 verification passed: `opportunity_stage_history` and `opportunity_stage_ownership_periods` are present in project `jayxyikgefnzitxcbdov`.
- Live dashboard smoke test passed for pipeline stages, charts, role switching, marketer view, authenticated CRM workspace loading, and browser console errors. The signed-in production workspace showed the live pipeline and follow-up view; the production API health route was also observed in Vercel runtime logs.
- Strict screenshot comparison against the design reference remains blocked by the browser comparison policy; functional verification passed.
- Dashboard completion local verification passed: all five role contexts were smoke-checked with safe test data; 19 domain/permission/dashboard tests, API typecheck, web typecheck, production build, and `git diff --check` pass. The pre-Xaviar form refinement added explicit labels and required constraints for follow-up, handoff, and incorrect-report controls. The local web bundle warning remains non-blocking: the main compressed bundle is approximately 200 kB gzip and can be split later.
- PR #7 remote validation passed: GitHub Actions workflow `Validate Elevanta AI`, run 135, completed successfully after correcting the workflow order so pnpm is installed before Node cache setup. The merged release includes the CRM core, dashboard completion, and follow-up completion migration files; no real lead data was included.
- Supabase console/SQL check on 2026-07-29: project health is Healthy and Auth reports no recent warnings/errors. SQL confirmed the seven foundation tables and the expected public CRM routines, including the reconciled status, source-validation, and timestamp controls. The full local migration bundle was intentionally not re-run because it stopped at the existing `app_role` type; the safe reconciliation patch was applied instead and no data, tables, or schemas were dropped. The migration ledger is still absent, so traceability remains open. Vercel has the approved Supabase variables configured for Production/Preview. The merged production deployment for `8ce737b` is Ready; the Vercel check passed after the production API-origin fix. Signed-in smoke test with `codex.smoketest@elevanta.test` passed previously; the remaining browser confirmation is to refresh the live dashboard and verify the toast no longer appears. No real lead data was included.

## Rules for future updates

1. Before changing scope, compare the request with `CRM-PLAN.md` and `CRM-DECISIONS-v1.1.md`.
2. If a request changes an approved decision, ask permission before creating a new decision version.
3. Update this file after every completed milestone or material blocker.
4. Keep private workbook/lead data out of the public repository.
5. Do not enable Phase 2 outbound automation until consent, unsubscribe, and human-approval controls are implemented.
6. Do not reopen or request production Excel migration during Milestones 1–4. Use safe sample/synthetic data for testing; schedule real-data staging, validation, and activation only under Milestone 5.

## Latest production incident

On 2026-07-30 the live dashboard initially showed `CRM connection unavailable: CRM request failed (404)`. The failure was reproduced while signed in: Vercel returned `NOT_FOUND` for `/api/v1/opportunities` before the Node API executed. PR [#12](https://github.com/CharlesSmith999/elevanta-ai/pull/12), merged as `93d1499`, adds a concrete Vercel function route for CRM `/api/v1/*` traffic. A follow-up live test then exposed the real database gate: the required `profiles.department` migration had not been applied and the `authenticated` database role lacked SELECT permissions despite the existing Row Level Security policies. The missing schema change and grants were applied in Supabase; PR [#13](https://github.com/CharlesSmith999/elevanta-ai/pull/13), merged as `89bc441`, records the permission repair. A fresh signed-in production test now loads the dashboard with **zero** CRM connection errors.

## Next milestone target

Milestones 1–3 are closed for the released safe-sample CRM foundation. The pre-Xaviar technical refinement gate is complete; the only remaining gate item is Shariq's explicit approval of the Phase 1 screen and field contract. Once approved, begin Milestone 4 Xaviar development with synthetic/safe sample data. After Milestone 4, begin Milestone 5 production lead-data migration using staging, provenance, deterministic duplicate handling, and validation before any records enter active routing.
