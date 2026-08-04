# Elevanta AI — Dashboard Revamp Decisions v1.0

Status: Approved by product owner on 2026-08-04

This is the governing decision record for the next dashboard redesign. It supplements [CRM-PLAN.md](./CRM-PLAN.md), [CRM-DECISIONS-v1.5.md](./CRM-DECISIONS-v1.5.md), [DASHBOARD-DATA-DICTIONARY.md](./DASHBOARD-DATA-DICTIONARY.md), and [XAVIAR-EVALUATION-PLAN.md](./XAVIAR-EVALUATION-PLAN.md). It does not authorize dashboard code changes by itself; the role-by-role screen specification is the next required planning output.

## 1. Approved operating decisions

| Area | Approved decision |
|---|---|
| Manager model | Use one `Manager` system role with a required department. A Manager in Marketing is a Marketing Manager; a Manager in Sales is a Sales Manager. |
| Direct manager | A non-admin user has one direct manager in Phase 1. Multi-manager reporting is deferred. |
| MQL ownership | Marketing Agents and Marketing Managers may mark MQL. |
| SQL ownership | Sales Agents and Sales Managers may mark SQL. Managers and Admin may correct either qualification with audit history. |
| Sales acceptance | Sales records an explicit intake decision within one business day: `Accepted — working it`, `Needs more information`, `Not a fit`, `Duplicate`, or `Incorrect`. |
| No Answer | `No Answer` is a contact-attempt outcome, not a terminal opportunity status. The opportunity remains active and requires a next action. |
| Active opportunity standard | Every active opportunity requires a current status, next action, follow-up due date, and latest contact outcome when an attempt is logged. |
| Currency | Phase 1 financial reporting uses USD (`$`) as the workspace default. |
| Loss analysis | Lost leads and their controlled reasons are a primary sales and management insight. A new Lost or Not Interested outcome requires a reason. |
| Project type dictionary | Enable a controlled dropdown: Website Development, Mobile App, SEO, PPC, Social Media, Design / Branding, Other. Project-type reporting begins only after actual values are recorded. |
| Contact outcomes | Use the quick controlled outcomes: Connected, No Answer, Voicemail, Email Sent, Callback Requested, Not Interested, Meeting Booked, Other. Notes remain optional except where another workflow explicitly requires evidence. |
| Lead score preview | Remove the non-governed Lead Score preview from active dashboards. A true lead score is deferred until approved Xaviar scoring, audit, and evaluation work. |

## 2. Motivation and recognition — Phase 1

The platform motivates through progress, quality, consistency, and fair recognition. It does not use a single combined performance score in Phase 1.

### Recognition boards

- **Highest Result** — strongest current verified outcome.
- **Most Improved** — improvement against the person’s own prior period.
- **Quality Champion** — clean, accepted, and useful lead work.
- **Consistency Champion** — reliable follow-ups, response timing, and healthy operating habits.

### Recognition examples

| Role | Examples |
|---|---|
| Sales Agent | Fast Response, Follow-up Reliability, Pipeline Mover, Closer, Most Improved |
| Marketing Agent | Quality Builder, Sales-Ready Creator, Clean Data Champion, Fast Router, Most Improved |
| Manager | Team Health Improvement, Coaching Follow-through, Assignment Balance Improvement |
| Admin | Company and department recognition across quality, improvement, and operational health |

### Privacy and fairness

- Individual agents see their own progress, achievement, and anonymized team benchmark only.
- Managers see named direct-report results; Admin sees named workspace-wide results.
- A named selected-period result requires at least 10 valid opportunities; Proposal-to-Won recognition requires at least 5 proposals; an anonymized team benchmark requires at least 3 qualifying people.
- Confirmed Incorrect and Duplicate records are excluded from normal conversion calculations.
- Results use source-separated reporting, sample size, ownership periods, and the recorded date range. They do not call a person universally “best” across unmatched sources.
- Phase 1 recognition is in-product only: progress, badges, and manager recognition. There are no cash points, penalties, or automatic rewards.

## 3. Dashboard design rule

Every role dashboard is organized in this order:

1. **Work now** — urgent actions, risks, and the role’s immediate queue.
2. **Performance** — role-specific results for the selected period, including count and denominator.
3. **Improve** — trends, strengths, risks, and the next practical improvement area.
4. **Recognition and benchmark** — private or permitted role-safe context, never an unsupported universal rank.

The design must answer: “What needs attention now?”, “How am I or my team performing?”, and “What should improve next?” Charts exist only when they support one of these questions.

## 4. Explicitly deferred items

| Item | Deferred destination |
|---|---|
| Admin/manager numerical goals and targets | Future dashboard milestone / wishlist; no hard-coded goals now. |
| Combined personal performance score | Future wishlist after fair weighting and enough outcome data exist. |
| Final benchmark cohorts and universal cross-source rankings | Xaviar evaluation and real CRM evidence. |
| Governed lead score, close probability, and predictions | Xaviar Milestone 4 evaluation gates. |
| Cash rewards, penalties, or formal incentive management | Future product decision. |
| Real lead-data migration and production benchmarks | Milestone 5 only. |
| Call transcription, communication-quality scoring, and outbound integrations | Phase 2. |

## 5. Next planning gate

Before implementation, produce and approve a role-by-role dashboard screen specification for Company Admin, Marketing Manager, Marketing Agent, Sales Manager, and Sales Agent. It must map every card, queue, chart, empty state, drill-through, and permission boundary to an approved metric or workflow.
