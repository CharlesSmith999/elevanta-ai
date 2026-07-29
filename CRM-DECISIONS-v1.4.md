# Elevanta AI — CRM Intelligence Readiness Decisions v1.4

Status: Approved by product owner; benchmark cohort rules remain open

This decision record extends `CRM-DECISIONS-v1.3.md` and the baseline in `CRM-PLAN.md`.

| Decision | Approved rule |
|---|---|
| Source model | The source field itself stores labels such as Bark Paid, Bark Stalk, Thumbtack, SEO, Social Media, Clutch, Email Marketing, LinkedIn, PPC, or Other. |
| Separate channel field | Not required for the current CRM version. |
| Campaign field | Not required initially because the source label can identify the campaign. |
| Unknown source | Use `Other` and route the record to data-quality review when clarification is needed. |
| Data origin | No user-maintained origin field. Imported workbook records are historical through import provenance; CRM form records are newly recorded activity. |
| Historical financial data | Total cost, upfront cost, and won date are `Not available` when the old workbook does not contain them. |
| New Won opportunities | Capture total project cost, upfront payment amount, and automatically set won date when status becomes Won. |
| Benchmark rules | Keep source/cohort benchmark rules open until after Xaviar development and evaluation have produced enough real CRM evidence. |
| Benchmark/leaderboard safeguards | Show sample size, respect reassignment ownership, separate most improved from highest result, and protect private contact information. |

The implementation checklist is [CRM-INTELLIGENCE-READINESS-PLAN.md](./CRM-INTELLIGENCE-READINESS-PLAN.md).
