# Elevanta AI — Role Dashboard Screen Specification v1.0

Status: Approved for implementation — Direction 1 selected by Shariq on 2026-08-04

This specification converts [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md) into screens. The selected visual target is recorded in [DASHBOARD-REVAMP-DESIGN-SET.md](./docs/DASHBOARD-REVAMP-DESIGN-SET.md). It is the mandatory approval gate before dashboard-revamp code begins. It does not change the data model, permissions, or Xaviar scope.

## 1. Shared experience rules

Every dashboard uses this order:

1. **Work now** — actionable queue and risks.
2. **Performance** — selected-period results with counts and denominators.
3. **Improve** — a trend, a known risk, and a practical next focus.
4. **Recognition** — role-safe progress and benchmark context.

### Common controls

- Period: Today, This Week, This Month, This Year, Lifetime, Custom.
- Source: one approved source/campaign at a time or All Sources.
- Status: role-safe lifecycle filter.
- Every rate shows its numerator and denominator.
- Missing evidence shows `Not available`; too-small samples show `Not enough data`.
- Every card, chart, and queue offers a drill-through to the permitted filtered records.

### Common design rules

- Cards show a decision, not decoration.
- Use a funnel for lifecycle movement, a line for change over time, horizontal bars for comparisons, and tables/queues for action.
- Do not show a combined performance score or Lead Score preview.
- Use green only for verified positive outcome/progress, amber for attention, and red for risk or overdue work.

## 2. Company Admin dashboard

### Purpose

Help leadership decide whether growth is limited by marketing quality, sales execution, operating discipline, or data quality.

### Screen order

| Area | Content | Primary action |
|---|---|---|
| Company command bar | Company / Marketing / Sales context, period, source, status, permitted person filter | Change scope without leaving the page |
| Business pulse | Leads, MQL, SQL, Won, open pipeline, total won value, upfront value | Open the relevant filtered records |
| Operating risks | Overdue follow-ups, stalled opportunities, unaccepted sales handoffs, Incorrect/Duplicate review, assignment imbalance, data-quality exceptions | Resolve or delegate risk |
| Growth journey | Company funnel: Created → MQL → SQL → Proposal → Won | Diagnose conversion loss |
| Marketing quality | Source quality table: valid leads, acceptance, MQL, SQL, Incorrect/Duplicate, downstream Won | Choose source/process intervention |
| Sales execution | Response-speed trend, follow-up completion, proposal-to-won, loss reasons, stage aging | Choose sales intervention |
| Recognition and comparison | Named permitted recognition boards: Highest Result, Most Improved, Quality Champion, Consistency Champion | Recognize performance; never punish from this view |

### Required charts

- Company conversion funnel.
- Source-by-source quality bars; no unmatched-source universal rank.
- Weekly/monthly lead, SQL, and Won trend.
- Loss-reason horizontal bars.
- Pipeline-stage aging bars.

## 3. Marketing Manager dashboard

### Purpose

Help the Marketing Manager improve the quality, completeness, routing speed, and sales usefulness of their team’s leads.

### Screen order

| Area | Content | Primary action |
|---|---|---|
| Team quality pulse | Leads created, Actionable Lead Yield, MQL, SQL, sales acceptance, routing speed, Incorrect/Duplicate rate | Open affected source or agent records |
| Quality-risk queue | Missing source, missing contact details, duplicate candidates, repeated incorrect reports, sales requests for more information, slow routing | Fix or coach before more leads are routed |
| Lead-quality journey | Created → Routed → Accepted → MQL → SQL → Won | Find the weak step |
| Source quality | Source/campaign comparison with count, acceptance, SQL yield, downstream Won | Improve targeting or source investment |
| Team improvement | Agent comparison: quality yield, clean-data rate, routing speed, trend against prior period | Coach a specific skill |
| Recognition | Named direct-report Quality Builder, Sales-Ready Creator, Clean Data Champion, Fast Router, Most Improved | Recognize quality work |

### Required charts

- Marketing quality funnel.
- Source quality comparison bars.
- Routing-speed trend.
- Incorrect/Duplicate trend.
- Agent improvement table with sample size.

## 4. Marketing Agent dashboard

### Purpose

Help the Marketing Agent create complete, clean, sales-useful leads and see how their work progresses after routing.

### Screen order

| Area | Content | Primary action |
|---|---|---|
| Primary action | Prominent `Add lead` button plus an import/validation shortcut when enabled | Create a complete lead |
| My quality pulse | Leads created, Actionable Lead Yield, MQL, SQL, sales acceptance, routing speed, clean-data rate | Review the underlying leads |
| My quality queue | Leads missing required intake details, duplicate candidates, Sales requests for information, unrouted leads | Repair before routing or rework |
| My impact journey | Created → Routed → Accepted → MQL → SQL → Won | Understand downstream impact |
| Source learning | Personal source mix and quality outcome by source | Repeat good targeting; stop weak patterns |
| My growth | Prior-period comparison, strongest habit, one improvement focus, private anonymized team benchmark | Improve the next controllable habit |

### Recognition

Private only: Quality Builder, Sales-Ready Creator, Clean Data Champion, Fast Router, Most Improved. No named peer ranking.

## 5. Sales Manager dashboard

### Purpose

Help the Sales Manager protect pipeline health, distribute work fairly, coach agents, and remove conversion blockers.

### Screen order

| Area | Content | Primary action |
|---|---|---|
| Team execution pulse | Open opportunities, due today, overdue, median response speed, connection rate, proposal-to-won, total won and upfront value | Open team work or conversion detail |
| Operating watchlist | Unaccepted handoffs, uncontacted new assignments, overdue follow-ups, stalled proposals, aging opportunities, overloaded agents | Reassign, coach, or intervene |
| Team funnel | Assigned → Contacted → Connected → SQL → Proposal → Won | Locate the stage bottleneck |
| Workload and discipline | Agent workload, follow-up completion, response speed, aging distribution | Balance work and coach habits |
| Loss and recovery | Loss reasons, lost stage, source context, opportunities suitable for later reactivation | Improve process and scripts |
| Team recognition | Named direct-report Fast Response, Follow-up Reliability, Pipeline Mover, Closer, Most Improved | Recognize and coach fairly |

### Required charts

- Team conversion funnel.
- Stage-aging distribution.
- Follow-up completion and overdue trend.
- Loss-reason horizontal bars.
- Workload versus follow-up-health comparison.

## 6. Sales Agent dashboard

### Purpose

Help the Sales Agent decide whom to work now, complete follow-ups, move qualified prospects forward, learn from losses, and improve personal habits.

### Screen order

| Area | Content | Primary action |
|---|---|---|
| Today’s priority queue | New assignments needing first contact, due today, overdue, stalled, proposal follow-ups, reassigned leads | Log contact, update status, schedule follow-up, open full permitted context |
| My execution pulse | Open leads, due today, overdue, median response time, connection rate, follow-up completion | Work the next priority lead |
| My conversion path | Assigned → Connected → SQL → Proposal → Won | See current-stage progress |
| My loss learning | Lost / Not Interested count, controlled reasons, source context, loss stage | Identify one improvement pattern |
| My growth | Prior-period trend, strongest habit, one next improvement focus, private anonymized benchmark | Improve a controllable skill |
| My recognition | Private Fast Response, Follow-up Reliability, Pipeline Mover, Closer, Most Improved | Build confidence without exposing peers |

### Required charts

- Personal conversion funnel.
- Follow-up completion trend.
- Loss-reason bars.
- Pipeline-aging bars.
- Private prior-period comparison with sample size.

## 7. Data and behavior dependencies

| Insight | Required recorded evidence |
|---|---|
| Response speed | Assignment timestamp and first contact activity |
| Follow-up reliability | Follow-up due date and completion timestamp |
| Sales acceptance | Approved intake decision within one business day |
| Marketing quality | Marketing owner, source, qualification, acceptance, downstream outcome |
| Loss learning | Lost/Not Interested status, controlled reason, stage and source |
| Financial outcome | Won status/date, total project cost, upfront payment, USD currency |
| Improvement / badges | Valid current-period results plus a comparable prior period |
| Fair leaderboard | Minimum sample size, source scope, ownership periods, role permissions |

## 8. Explicitly not shown yet

- Combined performance score.
- Non-governed Lead Score preview.
- Close-probability prediction.
- Universal ranking across unmatched sources.
- Communication-quality or call-quality scoring.
- Target-versus-goal cards until the future targets feature is approved and built.

## 9. Approval checklist

- [ ] Each role’s purpose and screen order are approved.
- [ ] The defined cards and charts match a real decision or work action.
- [ ] Recognition visibility and privacy rules are approved.
- [ ] Loss analysis is sufficiently prominent for Sales and Sales Managers.
- [ ] No deferred Xaviar or real-data-migration capability is presented as live.
- [ ] Approval authorizes implementation planning; code changes require the normal test and release process.
