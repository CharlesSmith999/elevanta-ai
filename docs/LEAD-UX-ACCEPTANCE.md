# Lead/research UX acceptance, v1.15

Updated: 2026-09-29. Scope: approved [screen contract](LEAD-UX-REFINEMENT-PROPOSAL.md). PR #51 merged as `1f3446e1042b83661c71d329b60415e9036bf7ff`. Vercel deployment `89MU4BpFjVjJcjvXhwdwMtEXpjs6` is Ready/Current on production. v21 database migration applied and rollback-only live creation test passed with three contact methods. No test lead retained.

## Checks and evidence

| Area | Result |
|---|---|
| Application regression suite | 93 passed, 0 failed |
| Web and API TypeScript | Passed |
| Production web build | Passed; existing large-bundle warning remains |
| Database migration replay | All 26 migrations passed in isolated PGlite PostgreSQL |
| Database access and workflow tests | Passed, including revision guards, masked contact rejection and assigned Sales visibility |
| Multi-contact creation | Two phones and one email entered, reviewed and saved in local browser; all three visible to assigned Owais Sales view |
| Research publication | Local Marketing edited Sample App Lead, added email, saved Ready for Sales, reviewed handoff and assigned to Mustabeen |
| Navigation | Fixed dashboard lead click clearing selected record; lead/detail navigation resets scroll |
| Loading | Unknown connection health is no longer labeled disconnected; initial queue counts show loading |
| Draft handling | Form review preserves inputs; unsaved research warns on Back/reload; pending contact entries must be added before save |

Test-environment issue: API tests initially could not open a local server under restricted execution. Rerunning with local-server permission passed all 93 tests. Browser pointer activation was inconsistent in the automation session; keyboard activation verified the tested flows. Do not count pointer-only interaction testing as complete.

## Release gates

- Database gate passed: v21 installed and recorded; anonymous execution denied; rollback-only multi-contact test passed.
- Publication passed: PR #51, successful GitHub validation, merged to existing main.
- Deployment passed: existing Vercel project reports Ready/Current; API health and readiness pass.
- Confirm authenticated multi-contact save and research assignment with an approved disposable test record, or report this as unverified.
- Complete visual/pointer checks across both themes and mobile/desktop. Current local browser checks are not a claim of exhaustive visual parity.

No real lead data or mailbox credentials are included in this release. No lead migration is performed.

## Sales Agent workflow v2 local acceptance, September 30, 2026

| Area | Result |
|---|---|
| Sales work queue | Passed: action summaries, queue filters, contact readiness, latest activity, next action, urgency and Open action are visible |
| Role-aware columns | Passed: Owner is removed for the assigned Sales Agent and retained for management roles |
| Lead action center | Passed: overdue state, primary contact, latest context, lifecycle, qualification and lead brief are visible before contact administration |
| Activity logging | Passed: outcome starts unselected; phone/email method and notes are clear; no-answer-type outcomes reveal follow-up scheduling |
| Atomic next step | Passed against the existing API contract: activity and optional follow-up are submitted in one workflow call |
| Contact quality | Passed: Sales can keep verified methods active and move incorrect, wrong-person, reception or do-not-contact methods out of active focus without deleting audit history |
| Mobile | Passed at 390 px: compact header, readable action center and persistent Contact, Log and Follow-up bar without horizontal overflow |
| Themes | Passed in light and dark mode |
| Regression | 93 tests passed; web TypeScript and production build passed |

No database migration was needed and no record was changed during browser verification. Publication and deployment are intentionally pending explicit approval.
