# Elevanta AI — Phase 1 Edge-Case Test Plan

Status: Test plan created; execution in progress
Created: 2026-07-30
References: `CRM-PLAN.md`, `CRM-DECISIONS-v1.1.md`, `PROJECT-STATUS.md`, `docs/ADMIN-USER-MANAGEMENT.md`, `docs/ARCHITECTURE-API-IMPLEMENTATION.md`

The released baseline cases in this file remain valid. The approved, not-yet-implemented lead-workflow v1.6 additions are specified separately in [LEAD-WORKFLOW-EDGE-TEST-CASES-v1.0.md](./LEAD-WORKFLOW-EDGE-TEST-CASES-v1.0.md) and must be added to the executable suite during that development phase.

## Purpose

This is the standing edge-case checklist for the functionality delivered before Xaviar development. It protects the approved rules for authentication, role visibility, lead lifecycle, assignments, follow-ups, incorrect/duplicate review, dashboards, data quality, and deployment. Production Excel migration remains out of scope until Milestone 5.

## Result definitions

- **PASS** — automated or live check behaved as expected.
- **FAIL** — behavior violates the expected result and must be fixed before the relevant milestone is considered safe.
- **BLOCKED** — the check needs a live account, secret, or external system not available to the automated suite.
- **NOT RUN** — documented for a later phase or intentionally deferred by the project plan.

## Test cases

| ID | Area | Edge case | Expected result | Execution |
|---|---|---|---|---|
| AUTH-01 | Authentication | Valid active Admin signs in | Dashboard loads and CRM API returns data | Live smoke |
| AUTH-02 | Authentication | Wrong password | Sign-in fails without revealing whether the email exists | Manual/live |
| AUTH-03 | Authentication | Expired/invalid bearer token | API returns 401; no lead data is returned | API/live |
| AUTH-04 | Authentication | Active auth user has no profile | API returns a safe 403; no data leaks | API/live |
| AUTH-05 | Authentication | Profile is inactive | API returns a safe 403; account cannot work leads | API/live |
| AUTH-06 | Authentication | Sign out then revisit protected screen | Session is cleared and login screen is shown | Live smoke |
| ROLE-01 | User management | Create Admin with department or manager | Request is rejected; Admin has neither field | Automated/API |
| ROLE-02 | User management | Create Manager without department | Request is rejected | Automated/API |
| ROLE-03 | User management | Create Sales Agent without manager | Request is rejected | Automated/API |
| ROLE-04 | User management | Create Marketer under Sales manager | Request is rejected for department mismatch | Automated/API |
| ROLE-05 | User management | Create agent under inactive/non-manager/different-workspace manager | Request is rejected | Automated/API |
| ROLE-06 | User management | Duplicate email or malformed email | Request is rejected; no partial profile remains | API/live |
| ROLE-07 | User management | Admin tries to deactivate self | Request is rejected | Automated/API |
| ROLE-08 | User management | Deactivate last active Admin | Request is rejected | Automated/API |
| ROLE-09 | User management | Deactivate user with active lead assignments | Request is rejected until leads are reassigned | Automated/API |
| ROLE-10 | User management | Change manager role/department while active reports exist | Request is rejected until reports are reassigned | Automated/API |
| LEAD-01 | Lead creation | Name plus phone | Lead is accepted | Automated/API |
| LEAD-02 | Lead creation | Name plus email | Lead is accepted | Automated/API |
| LEAD-03 | Lead creation | Name only, no phone/email | Request is rejected | Automated/API |
| LEAD-04 | Lead creation | Blank name, phone/email present | Request is rejected | Automated/API |
| LEAD-05 | Lead creation | Invalid email or overlong fields | Request is rejected with field validation | Automated/API |
| LEAD-06 | Lead creation | Unapproved source | Request is rejected | Automated/API |
| LEAD-07 | Lead creation | Approved source with no campaign detail | Lead uses the approved source and default campaign behavior | Automated/API |
| LEAD-08 | Lead creation | Won lead with negative cost or upfront greater than total | Request is rejected | Automated/domain |
| LEAD-09 | Lead update | Won lead without valid financial values | Data-quality issue is reported; conversion is not silently overstated | Automated/domain |
| LEAD-10 | Lead update | Terminal lead is moved back to an active status | Normal transition is rejected | Automated/domain |
| LEAD-11 | Lead update | Activity is added after terminal status | Data-quality issue is reported | Automated/domain |
| ACCESS-01 | Visibility | Sales agent requests another agent’s lead | Lead and restricted contact details are hidden | Automated/domain/API |
| ACCESS-02 | Visibility | Manager requests managed agent’s lead | Lead is visible | Automated/domain/API |
| ACCESS-03 | Visibility | Manager requests unrelated team’s lead | Lead is hidden | Automated/domain/API |
| ACCESS-04 | Visibility | Marketer requests a lead they do not own | Lead is hidden | Automated/domain/API |
| ACCESS-05 | Visibility | Admin requests any lead | Lead is visible | Automated/domain/API |
| ACCESS-06 | Visibility | Agent opens named leaderboard or data-quality board | Restricted board is hidden or rejected | Automated/domain |
| ASSIGN-01 | Assignment | Reassign to a valid same-team owner | Previous assignment closes; new active owner is recorded | Automated/domain/API |
| ASSIGN-02 | Assignment | Reassign to a different manager’s agent | Request is rejected | Automated/API |
| ASSIGN-03 | Assignment | Fresh-start handoff | New agent sees the permitted fresh view; history remains available to manager/admin | API/live |
| ASSIGN-04 | Assignment | Full-context handoff | New agent receives prior thread permitted by the handoff | API/live |
| ASSIGN-05 | Assignment | Reassign routing-paused lead | Request is rejected until Admin review | Automated/domain/API |
| ASSIGN-06 | Assignment | Stage spans a reassignment | Stage ownership time is split between owners; no owner is judged for another owner’s time | Automated/domain |
| FOLLOW-01 | Follow-up | Due today | Appears in due-today work | Automated/domain |
| FOLLOW-02 | Follow-up | Past-due open follow-up | Appears as overdue | Automated/domain |
| FOLLOW-03 | Follow-up | Completed follow-up | No longer counts as open/overdue | Automated/domain/API |
| FOLLOW-04 | Follow-up | Cancelled follow-up | Does not count as open/overdue | Automated/domain/API |
| FOLLOW-05 | Follow-up | Active lead with no open next action | Data-quality issue is reported | Automated/domain |
| REVIEW-01 | Incorrect | Same agent reports three times | Counts once, not three times | Automated/domain/API |
| REVIEW-02 | Incorrect | Three distinct agents report one opportunity | Exactly one pending Admin review is created and routing pauses | Automated/domain/API |
| REVIEW-03 | Incorrect | Admin rejects review | Lead remains auditable and routing can resume | API/live |
| REVIEW-04 | Incorrect | Admin confirms incorrect | Lead is sidelined and excluded from normal conversion | API/live |
| REVIEW-05 | Duplicate | Exact normalized phone match | Candidate is flagged | Automated/domain |
| REVIEW-06 | Duplicate | Exact normalized email match, different case/spacing | Candidate is flagged | Automated/domain |
| REVIEW-07 | Duplicate | Similar but non-identical phone/email | Candidate is not falsely flagged | Automated/domain |
| REVIEW-08 | Duplicate | Duplicate candidate is compared in dashboard | Duplicate is excluded from conversion metrics without deleting history | Automated/domain |
| DASH-01 | Dashboard | Daily/weekly/monthly/yearly/lifetime filters | All cards, charts, boards use the same selected date range | Automated/domain/live |
| DASH-02 | Dashboard | Custom range with no matches | Empty state is shown; no divide-by-zero or invented rate | Automated/live |
| DASH-03 | Dashboard | Bark Paid vs Bark Stalk | Source metrics remain separate; no unfair cross-source benchmark | Automated/domain |
| DASH-04 | Dashboard | Zero denominator conversion rate | Rate is shown as unavailable/zero safely, never NaN/Infinity | Automated/domain |
| DASH-05 | Dashboard | Small leaderboard sample | Sample-size safeguard prevents misleading ranking | Automated/domain/live |
| DASH-06 | Dashboard | Revenue with no Won financial records | Shows Not available/zero according to the field contract | Automated/domain/live |
| DASH-07 | Dashboard | Role-specific filters | User cannot filter into another role’s restricted data | Automated/live |
| DATA-01 | Data quality | Missing/unapproved source | Exception is listed | Automated/domain/live |
| DATA-02 | Data quality | Won record missing cost/upfront | Exception is listed | Automated/domain |
| DATA-03 | Data quality | Assignment ends before it starts | Exception is listed | Automated/domain |
| DATA-04 | Data quality | Stage exits before entry | Exception is listed | Automated/domain |
| DATA-05 | Data quality | Dashboard reconciliation | Benchmark count plus excluded count equals filtered lead count | Automated/domain |
| API-01 | Deployment | `/api/health` | Returns HTTP 200 health payload | Live/Vercel |
| API-02 | Deployment | `/api/v1/opportunities` without bearer token | Reaches Node API and returns 401, not Vercel NOT_FOUND | Live/Vercel |
| API-03 | Deployment | `/api/v1/opportunities` with active Admin token | Returns permitted CRM data | Live/Vercel |
| API-04 | Deployment | Vercel preview and production | Both use the same `/api/v1/*` route and environment contract | CI/live |
| API-05 | Database | Authenticated role SELECT grants and RLS | Grants permit reads; RLS still limits workspace/role visibility | Supabase SQL/live |
| API-06 | Database | `profiles.department` migration | New users can store marketing/sales department with the approved constraint | Supabase SQL |

## Execution record

Execution must be appended below after every run. Do not mark a case PASS from source inspection alone when a live/API check is required.

### Run 2026-07-30 — Phase 1 foundation regression

| Scope | Result | Evidence |
|---|---|---|
| Existing automated domain suite | PENDING | Run `pnpm test:domain` and record the CI run URL/number. |
| Typecheck and production build | PENDING | Run `pnpm typecheck` and `pnpm build`. |
| Live Admin sign-in and `/api/v1/opportunities` | PASS | Reproduced and verified on the production deployment after the dedicated Vercel v1 route, `profiles.department` migration, and authenticated SELECT grants. |
| Live role creation for all four roles | BLOCKED | Requires creating disposable Auth users and credentials; source/API validation is covered by ROLE-01 through ROLE-10. |
| Legacy test-profile department normalization | OPEN | Existing test profiles created before the department migration have NULL department values; new profiles are required to provide the correct department. |

## Release gate

Milestones 1–3 remain closed only when automated tests pass, the live API route returns an authenticated response instead of Vercel NOT_FOUND, and no unresolved critical access-control failure remains. Xaviar development stays deferred until this regression run is complete and the remaining open legacy test-profile decision is resolved.
