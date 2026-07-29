# CRM Intelligence Readiness Plan

Status: Approved working plan; benchmark cohort rules remain open

Purpose: Prepare the CRM dashboards and data structures before Milestone 4 Xaviar development. This document is subordinate to [CRM-PLAN.md](./CRM-PLAN.md) and is the implementation checklist for source reporting, financial tracking, benchmarks, leaderboards, and dashboard readiness.

## 1. Source model

The `source` field is the campaign/source label itself. We do not add a separate channel field at this stage.

Examples:

- Bark Paid
- Bark Stalk
- Thumbtack
- SEO
- Social Media
- Clutch
- Email Marketing
- LinkedIn
- PPC
- Other

Every lead must have a source. If the source is genuinely unknown, use `Other` and record the reason in notes or data quality review. Because the source already identifies the acquisition route or campaign, a separate campaign field is not required for the initial CRM version.

## 2. Historical and new records

We will not add a user-maintained `Data Origin` column.

- Imported workbook records are treated as historical through their import provenance and are labeled as historical in system metadata or reporting logic.
- Records created through the CRM form are treated as newly recorded CRM activity.
- Dashboards may show both together under the selected date range, with an optional advanced historical/new filter if needed later.
- Xaviar must distinguish historical imported records from new CRM activity when evaluating behavior.

## 3. Outcome and financial fields

Use the agreed controlled outcome and reason lists for MQL, SQL, Lost, Not Interested, Incorrect, Duplicate, and No Answer.

For new opportunities marked Won, capture:

- Total project cost
- Upfront payment amount
- Won date, automatically set when the opportunity is marked Won

For old imported opportunities where these values are unavailable, store `Not available`. Do not invent or estimate historical financial values.

## 4. Opportunity history

Log every assignment, reassignment, status change, note, follow-up, proposal action, outcome, and reason with actor and timestamp. Preserve time owned by each agent and the full reassignment chain. A reassigned agent must not be judged for activity that occurred before their ownership period.

## 5. Dashboard readiness build order

1. Finalize source and outcome dictionaries.
2. Add source validation and default `Other` handling.
3. Add won financial fields and automatic won date.
4. Complete opportunity history and stage-duration tracking.
5. Add date filters: daily, weekly, monthly, yearly, lifetime, and custom.
6. Add role dashboards and source-based breakdowns.
7. Add the Benchmark Board as a manager/admin view.
8. Add the Leaderboard with sample-size and privacy safeguards.
9. Add data-quality exceptions and dashboard reconciliation tests.
10. Approve this readiness gate before starting Xaviar implementation.

## 6. Benchmark Board

The Benchmark Board shows source-aware performance for managers and admins: connection, MQL, SQL, proposal, won, follow-up, response-time, and financial metrics. It must show counts, rates, period, source, and sample size.

The exact benchmark cohort rules remain intentionally open. They must be decided after Xaviar development and evaluation, using evidence from actual CRM activity. Until then, the system may show descriptive source-level metrics but must not make definitive “best versus worst” judgments across unmatched sources.

## 7. Leaderboard

The Leaderboard may show connection, SQL conversion, proposal-to-won conversion, follow-up consistency, response time, improvement, lead quality, and revenue performance.

Safeguards:

- Show sample size with every ranking.
- Separate most improved from highest result.
- Do not reward taking only easy leads.
- Respect reassignment ownership periods.
- Exclude confirmed duplicates and incorrect records from normal conversion.
- Keep private contact details hidden.
- Define agent visibility of colleagues’ names/ranks before release.

## 8. Readiness acceptance criteria

- Source values are standardized and available on every active lead.
- Outcome and reason values use controlled lists.
- New Won opportunities require total cost, upfront amount, and automatic won date.
- Historical records show `Not available` where financial values are absent.
- Opportunity history is complete and reassignment-aware.
- All dashboard periods and source filters reconcile to the underlying records.
- Benchmark Board and Leaderboard show counts, rates, period, source, and sample size.
- Data-quality and permission tests pass.
- Benchmark cohort rules remain visibly marked as open until formally decided after Xaviar evaluation.

