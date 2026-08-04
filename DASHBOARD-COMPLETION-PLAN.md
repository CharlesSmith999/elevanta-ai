# Dashboard Completion Plan

Status: Direction 1 approved; implementation in progress under `DASHBOARD-REVAMP-IMPLEMENTATION-TASK.md`

This plan supplements [CRM-PLAN.md](./CRM-PLAN.md), [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md), and [DASHBOARD-DATA-DICTIONARY.md](./DASHBOARD-DATA-DICTIONARY.md). The released dashboard baseline is complete. The next visual and operating redesign is governed by [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md); it does not change the approved lifecycle, access rules, source model, or final benchmark-cohort decision.

## Goal

Finish the role-aware dashboard experience requested for Elevanta AI before starting Xaviar. Every metric must respect the selected date range, source filter, role visibility, reassignment ownership, and the missing-data rules in the dashboard data dictionary.

## Role views

### Admin — company view

- Company pipeline, lead volume, MQL/SQL, conversion funnel, revenue, upfront value, and trend charts.
- Marketing quality: source performance, actionable-lead yield, non-actionable-lead rate, sales acceptance, duplicate/incorrect rates, and routing speed.
- Sales performance: connection, response speed, follow-up completion, proposal-to-won, lost reasons, stage aging, workload, and assignment imbalance.
- Company leaderboard and benchmark board, with named staff only where Admin already has workspace-wide visibility.
- Data-quality, review-queue, and reconciliation views.

### Marketing manager — department view

- Marketing team volume, MQL/SQL yield, source quality, sales acceptance, downstream conversion, routing speed, duplicate/incorrect trends, and outstanding quality risks.
- Marketing-agent comparison and a named marketing leaderboard for that manager's team.

For Phase 1, Shariq's admin account may open this department-scoped view without becoming a separate authentication role.

### Sales manager — department view

- Team pipeline, MQL/SQL-to-won, connection, response speed, follow-up completion, proposal-to-won, revenue, lost reasons, aging, handoffs, and workload.
- Sales-agent comparison and a named leaderboard limited to direct reports.

### Sales agent — personal view

- Personal engagement, connection, response speed, follow-up health, MQL/SQL-to-won conversion, proposal-to-won conversion, lost reasons, lost prospects, stage aging, and revenue/won performance.
- A private personal leaderboard card: own score, sample size, trend, and anonymized team benchmark. Colleagues' names and contact data remain hidden.

### Marketing agent — personal view

- Lead volume, source mix, MQL/SQL yield, actionable-lead yield, non-actionable-lead rate, sales acceptance, downstream conversion, routing speed, duplicate/incorrect rate, and quality-risk trends.
- A private personal leaderboard card: own score, sample size, trend, and anonymized marketing-team benchmark. Colleagues' names and contact data remain hidden.

## Data required

The completion pass adds or standardizes these audit-backed values:

- `lost_reason` from a controlled list when an opportunity is marked Lost or Not Interested.
- First contact timestamp, sourced from the first Contacted/Connected activity or stage event.
- Qualification timestamp, proposal timestamp, and first sales-assignment timestamp.
- Follow-up completion timestamp and ownership period.
- Marketing-owner and current/historical sales-owner attribution.

Historical records remain `Not available` where evidence is missing; the dashboards must not convert missing values into zero.

## Leaderboard safeguards

- All leaderboard rows show period, source scope, and sample size.
- Confirmed Incorrect and Duplicate records are excluded from normal conversion.
- Highest result and most improved are separate calculations.
- Manager views are limited to direct reports; Admin has workspace-wide visibility.
- Individual agents and marketers see their own result plus an anonymized team benchmark, not peer names.
- Small samples show `Not enough data` rather than a rank.

## Completion gates

1. The missing dashboard fields/events are present in migrations, API contracts, and safe fixtures.
2. Every role view exposes its required cards, charts, filters, and empty states. Date, source, status, and role-safe team-member filters are complete; project-type filtering remains intentionally unavailable until the CRM form has an approved project-type dictionary and recorded values.
3. Dashboard totals reconcile with visible records and selected filters.
4. Marketing and sales leaderboards respect role visibility, sample size, source separation, and reassignment attribution.
5. Tests cover Admin, Marketing Manager, Sales Manager, Marketing Agent, and Sales Agent.
6. The application passes typecheck, domain tests, and production build before release.

Xaviar development remains blocked until these gates and the existing readiness acceptance criteria pass.

## Future wishlist (after the current dashboard scope)

- **Lead scoring:** add a governed lead-score model to Lead Inbox using source-aware signals, qualification, engagement, follow-up behavior, and later conversion evidence. No score or preview is shown until the scoring rules, audit trail, and Xaviar evaluation plan are approved.
- **Targets and goals:** allow Admin to set company and department targets, with Managers setting permitted team goals. No target may be silently hard-coded.
- **Combined performance score:** consider only after transparent weighting, fair source cohorts, sufficient outcomes, and Xaviar evaluation.
- **Recognition evolution:** begin with in-product recognition; consider formal rewards only through a later approved product decision.
