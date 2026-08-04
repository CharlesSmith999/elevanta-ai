# Role Dashboard Reference Implementation

**Version:** v1.0
**Approved direction:** Direction 1
**Date:** 2026-08-04
**Parent plan:** [DASHBOARD-REVAMP-IMPLEMENTATION-TASK.md](./DASHBOARD-REVAMP-IMPLEMENTATION-TASK.md)
**Screen specification:** [DASHBOARD-ROLE-SCREEN-SPEC-v1.0.md](./DASHBOARD-ROLE-SCREEN-SPEC-v1.0.md)
**Design index:** [docs/DASHBOARD-REVAMP-DESIGN-SET.md](./docs/DASHBOARD-REVAMP-DESIGN-SET.md)

## Scope

This contract implements the approved light and dark reference screens for:

- Marketing Manager — Marketing Quality Command.
- Sales Manager — Sales Command Center.
- Marketing Agent — My Marketing Workspace.
- Sales Agent — My Sales Workspace.

Admin remains governed by [ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md](./ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md).

## Shared visual and behavior contract

- Dark and light modes render the same sections, cards, charts, labels, actions, and data. Only color tokens change.
- Period and source filters affect the visible dashboard data.
- Role navigation, Add lead, View all, Reports, follow-up, leaderboard, and lead-detail actions use the existing CRM routes and permission rules.
- Dashboard values come from the role-visible CRM records. Approved design screenshots define composition and appearance; their fictitious numbers are never copied.
- Missing evidence renders as `Not available` or `Not enough data`.
- Named recognition is restricted to management roles. Agent recognition and benchmarks remain private.

## Role contracts

### Marketing Manager

- Six Work now cards for created leads, actionable yield, MQL, SQL, sales acceptance, and quality risks.
- Performance row with lead-quality funnel, quality-risk queue, source-quality ranking, and routing/acceptance trend.
- Five detailed recognition cards with evidence, agent identity, sample size, and leaderboard drill-through.

### Sales Manager

- Six Work now cards for open work, due/overdue activity, response time, connection rate, and proposal-to-won conversion.
- Team pipeline, operating watchlist, loss/recovery, and workload/follow-up discipline rings.
- Five detailed recognition cards with manager-visible names, samples, and results.

### Marketing Agent

- Prominent Add lead action and five-card quality queue.
- Six quality cards, impact journey, five-column source-learning table, and routing/acceptance trend.
- Private growth and recognition sections.

### Sales Agent

- Actionable priority queue with direct lead-detail navigation.
- Six execution cards, conversion path, loss learning, growth guidance, and private recognition.

## Data and platform impact

- No new database migration is required for this visual implementation.
- The existing lead, assignment, stage-history, activity, follow-up, source, loss-reason, and Won-financial fields supply the implemented metrics.
- A distinct safe Marketing Manager test identity is included so the approved role can be validated without production data.
- Real workbook migration remains deferred to Milestone 5.

## Acceptance gate

Release only after web/API typechecks, domain tests, production build, light/dark parity checks, role-permission checks, interaction checks, and side-by-side visual review pass. Evidence is recorded in [design-qa.md](./design-qa.md).
