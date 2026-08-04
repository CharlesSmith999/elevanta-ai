# Elevanta AI — Dashboard Data Dictionary

Status: Step 1 of dashboard redesign — working baseline

This document locks the shared definitions used by every dashboard. It supports [CRM-PLAN.md](./CRM-PLAN.md) and [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md). No dashboard may calculate the same metric differently by role.

## 1. Source values

The source field is also the campaign/source label. There is no separate channel field in the current version.

Approved starting values:

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

`Other` is used when the source is unknown and creates a data-quality item for review. New source values require an admin-controlled dictionary update; users should not create spelling variants.

## 1.1 Dashboard event fields

- **Loss reason:** required from the controlled list when a new CRM opportunity is marked Lost or Not Interested: Price or budget, No response, Timing or priority, Competitor selected, Not a fit, Proposal declined, or Other.
- **First contacted at:** first recorded Contacted or Connected event. It is used for response speed.
- **Qualified at:** first recorded Qualified event. It is used for qualification-period reporting.
- **Proposal sent at:** first recorded Proposal Sent event. It is used for proposal conversion.
- **First sales assignment:** first assignment history event. It is used for routing speed.

For historical data, absent evidence remains `Not available`; it is not inferred.

## 2. Lifecycle statuses

Working lifecycle:

`New → Assigned → Contacted → Connected → Follow-up Required → Qualified → Proposal Sent → Won/Lost`

Exception or terminal statuses:

- Not Interested
- Incorrect
- Duplicate
- Do Not Contact

Rules:

- Status changes are append-only history with actor, timestamp, previous status, new status, and reason where required.
- Won, Lost, Not Interested, Incorrect, Duplicate, and Do Not Contact are terminal for normal agent work.
- Confirmed Incorrect and Duplicate records are excluded from normal conversion calculations.
- A three-agent incorrect threshold creates an admin review; it does not delete a record automatically.

## 3. Qualification values

- MQL — Marketing Qualified Lead
- SQL — Sales Qualified Lead
- Not available

Qualification is separate from lifecycle status. A lead can be Connected and MQL, or Qualified and SQL. Missing historical qualification remains `Not available`.

### Qualification and sales-acceptance ownership

- Marketing Agents and Marketing Managers may record MQL.
- Sales Agents and Sales Managers may record SQL.
- Managers and Admin may correct either decision with audit history.
- Sales records one intake decision within one business day: `Accepted — working it`, `Needs more information`, `Not a fit`, `Duplicate`, or `Incorrect`.

### Contact outcomes

`No Answer` is a contact-attempt outcome, not a lifecycle status. Approved quick outcomes are: Connected, No Answer, Voicemail, Email Sent, Callback Requested, Not Interested, Meeting Booked, and Other. Selecting Not Interested also requires the corresponding terminal status and controlled reason.

Every active opportunity must have a current status, next action, and follow-up due date. When a contact attempt is logged, it also has a latest contact outcome.

### Project types and currency

The Phase 1 controlled project-type values are Website Development, Mobile App, SEO, PPC, Social Media, Design / Branding, and Other. Dashboard reporting remains `Not available` until real project-type values exist.

Phase 1 financial reporting uses USD (`$`) as the workspace default currency.

## 4. Date rules

| Metric or event | Date used |
|---|---|
| Lead volume | Lead created/source date |
| MQL or SQL volume | Date the qualification was recorded |
| Contact/connection rate | Date the relevant contact/connection event occurred |
| Response speed | Assignment time to first recorded contact |
| Follow-up performance | Follow-up due date and completion date |
| Stage aging | Stage entered date through stage exit/current date |
| Proposal conversion | Proposal sent date and later outcome date |
| Won revenue | Won date |
| Historical financial data | `Not available` if absent; never estimated |

Every dashboard supports daily, weekly, monthly, yearly, lifetime, and custom date ranges. Rate calculations use events inside the selected period and show the denominator.

## 5. Attribution rules

- Marketing metrics use the marketing owner and the source attached when the lead entered the CRM.
- Sales metrics use the sales owner and the time that owner controlled the opportunity.
- Reassigned work is attributed by ownership period and recorded activity, not only by final owner.
- An agent is not judged for time or follow-up activity before their assignment started.
- One contact may have multiple opportunities; each opportunity is counted separately for pipeline and conversion.
- Contact-level duplicate counts are not treated as separate opportunities.

## 6. Core metric definitions

### Lead quality

- **MQL rate:** MQL opportunities ÷ opportunities with a recorded qualification decision.
- **SQL rate:** SQL opportunities ÷ opportunities with a recorded qualification decision.
- **Incorrect rate:** confirmed incorrect opportunities ÷ opportunities reviewed or routed, with the denominator shown.
- **Duplicate rate:** duplicate candidates/confirmed duplicates ÷ opportunities reviewed or routed, with the denominator shown.
- **Sales acceptance rate:** opportunities progressed by Sales beyond intake ÷ opportunities routed to Sales.

### Sales performance

- **Contact rate:** opportunities with a recorded contact event ÷ assigned opportunities.
- **Connection rate:** opportunities with a Connected event ÷ assigned opportunities.
- **Follow-up completion:** completed follow-ups ÷ due follow-ups.
- **Proposal rate:** opportunities with Proposal Sent ÷ opportunities reaching the relevant sales stage.
- **Proposal-to-won rate:** Won opportunities ÷ opportunities with Proposal Sent.
- **Close rate:** Won opportunities ÷ closed opportunities (Won + Lost), with MQL/SQL filters available.
- **Response speed:** median time from assignment to first recorded contact; show average only as a secondary value.

### Marketing yield

- **Actionable Lead Yield:** opportunities progressing beyond intake into Contacted, Connected, MQL, SQL, Proposal Sent, or Won ÷ valid opportunities created.
- **Non-Actionable Lead Rate:** opportunities confirmed Incorrect, Duplicate, unusable, permanently unreachable, or never progressing beyond intake ÷ valid opportunities created.
- **Routing speed:** time from lead creation to first valid sales assignment.

### Financial metrics

- **Total project value:** sum of total project cost for Won opportunities with available values.
- **Upfront value:** sum of upfront payment amounts for Won opportunities with available values.
- **Average project value:** total project value ÷ Won opportunities with available project cost.
- Financial metrics exclude `Not available` values and show the count used.

## 6.1 Filter rules

- Every dashboard board applies the selected date range, source, and status to its cards, charts, tables, and leaderboard.
- Admin can additionally select company, marketing-department, or sales-department context and then filter by the relevant agent or marketer.
- The Sales Manager can filter only direct-report sales agents. Individual agents cannot inspect peer data.
- Project type is a stored opportunity field but is not yet required on the Phase 1 create form. A useful project-type dashboard filter will be enabled when the CRM form has an approved controlled project-type dictionary and recorded values; until then it must show `Not available`, not a fabricated grouping.

## 7. Dashboard treatment of missing data

- Show `Not available` rather than zero when the value was not recorded.
- Show count and rate together.
- Show “Not enough data” when a rate or comparison lacks a valid denominator.
- Never convert missing historical financial values into zero.
- Never treat missing notes as proof that no work occurred.

## 8. Benchmark and leaderboard status

Descriptive source-level metrics are allowed now. Final benchmark cohort rules remain open until after Xaviar development and evaluation, as recorded in `CRM-DECISIONS-v1.4.md`.

Until that decision is made:

- Show source, period, count, and rate.
- Do not declare a universal best or worst agent across unmatched sources.
- Show sample size beside every leaderboard result.
- Separate highest result from most improved.

## 9. Data-quality checks

Flag records with:

- Missing or unapproved source
- Missing status or qualification decision
- Won opportunity without available cost fields
- Follow-up without due date
- Active opportunity with no next action
- Invalid date order
- Activity after a terminal status
- Active opportunity without a next action or follow-up due date
- Sales assignment without a sales-acceptance decision after one business day
- Duplicate or incorrect review pending
- Assignment without a valid owner
