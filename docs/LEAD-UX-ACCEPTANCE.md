# Lead/research UX acceptance, v1.15

Date: 2026-09-28. Scope: approved [screen contract](LEAD-UX-REFINEMENT-PROPOSAL.md). Production application release pending. v21 database migration applied and rollback-only live creation test passed with three contact methods. No test lead retained.

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
- Publish reviewed changes against existing GitHub main. No new Vercel project.
- Verify resulting production deployment and API readiness.
- Confirm authenticated multi-contact save and research assignment with an approved disposable test record, or report this as unverified.
- Complete visual/pointer checks across both themes and mobile/desktop. Current local browser checks are not a claim of exhaustive visual parity.

No real lead data or mailbox credentials are included in this release. No lead migration is performed.
