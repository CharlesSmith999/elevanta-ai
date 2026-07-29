# Elevanta AI — Architecture and API Implementation Record

Status: Step 11–12 local implementation complete; publish/deployment pending the agreed combined release.

This record implements Sections 11 and 12 of `CRM-PLAN.md`. It is subordinate to `CRM-DECISIONS-v1.1.md` and the later approved decision versions.

## Architecture boundary

- React/Vite provides the role-aware shell, lead inbox, detail view, dashboards, review queue, Benchmark Board, Leaderboard, and Data Quality view.
- The Node.js/Express API is the only server boundary for CRM actions. It validates request bodies with Zod, requires a Supabase bearer session, and relies on Supabase Row Level Security for workspace and manager scope.
- Supabase PostgreSQL stores contacts, opportunities, assignments, activities, follow-ups, incorrect reports/reviews, audit events, and the staged opportunity-history migration.
- Mutations call database functions so authorization, state transition rules, and audit/history writes share one transaction boundary.
- Background notification and Xaviar jobs remain interfaces only; no outbound automation or live coaching is enabled in Phase 1.

## API surface

All routes are under `/v1` and require `Authorization: Bearer <Supabase access token>` unless noted.

| Resource | Routes | State |
|---|---|---|
| Session | `GET /me` | Implemented |
| Contacts | `GET /contacts`, `POST /opportunities` as the contact-plus-opportunity creation path | Implemented |
| Opportunities | `GET /opportunities`, `GET /opportunities/:id`, `PATCH /opportunities/:id` | Implemented with validation and RLS |
| Assignments | `POST /opportunities/:id/assignments` | Implemented; records reassignment history |
| Activities | `POST /opportunities/:id/activities` | Implemented as an audited note path |
| Follow-ups | `POST /opportunities/:id/follow-ups` | Implemented; future dates required |
| Incorrect review | `GET /admin/incorrect-reviews`, `POST /admin/incorrect-reviews/:id/decision` | Implemented; Admin only |
| Dashboards | `GET /dashboards/agent|manager|admin|marketer` | Implemented with role checks, period/source filters, and source samples |
| Coaching | `GET /coaching/:userId` | Explicitly deferred until Xaviar Milestone 4 evaluation |
| Imports | `POST /imports/validate`, `POST /imports/commit` | Explicitly deferred until Milestone 5; routes fail safely with 409 |

## Contract and safety rules

- Lead creation requires a name plus phone or email and uses an approved source; an unknown source is `Other`.
- Won status requires total project cost and upfront payment, with upfront payment no greater than total.
- Status, assignment, note, follow-up, incorrect-report, and Admin-review mutations are validated before calling Supabase RPCs.
- Dashboard role access is checked in the API and again by database RLS; agents cannot request manager/admin views.
- API responses do not include private contact fields in benchmark or leaderboard results.
- Import endpoints cannot accidentally activate production Excel data before Milestone 5.
- Errors return a stable `{ message, issues? }` shape; validation failures are 400, permission failures 403, deferred workflows 409, and domain transition failures 422.

## Release gate

Before publishing this local batch, run workspace typecheck, domain/API contract tests, production build, Supabase migration verification, and the Vercel `/api/health` smoke test. Do not create a second deployment instance.
