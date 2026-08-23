# Elevanta AI — CRM Dashboard and Operating Decisions v1.5

Status: Approved by product owner on 2026-08-04

This version extends [CRM-DECISIONS-v1.4.md](./CRM-DECISIONS-v1.4.md). It records the approved dashboard and operating decisions made before the dashboard revamp. The later [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md) specifically supersedes the manual Sales Acceptance row and adds the approved lead-workspace/contact-quality flow. All other non-conflicting decisions remain valid.

| Decision | Approved rule |
|---|---|
| Manager hierarchy | Use one Manager role with a required Marketing or Sales department; the department determines the manager dashboard and direct-report scope. |
| Direct manager | A non-admin user has one direct manager in Phase 1. Multi-manager reporting is deferred. |
| Qualification ownership | Marketing may set MQL; Sales may set SQL; Managers/Admin may correct either with audit history. |
| Sales acceptance | Sales records an intake decision within one business day using the approved controlled list. |
| Contact outcomes | No Answer is a non-terminal contact outcome. Approved quick outcomes are Connected, No Answer, Voicemail, Email Sent, Callback Requested, Not Interested, Meeting Booked, and Other. |
| Active-work requirements | An active opportunity requires status, next action, due date, and a latest contact outcome when an attempt is logged. |
| Lost outcomes | Lost and Not Interested require a controlled reason; loss analysis is a primary dashboard insight. |
| Currency | USD ($) is the Phase 1 workspace default for Won financial reporting. |
| Project types | Initial controlled values are Website Development, Mobile App, SEO, PPC, Social Media, Design / Branding, and Other. Reporting waits for recorded values. |
| Motivation approach | Use separate skill indicators and in-product recognition, not one combined performance score. |
| Recognition visibility | Agents receive private results and anonymized benchmarks; Managers receive named direct-report results; Admin has workspace-wide results. |
| Leaderboard safeguards | Use sample-size thresholds, source separation, ownership attribution, and distinct Highest Result / Most Improved / Quality / Consistency boards. Final cohort rules remain deferred to Xaviar evaluation. |
| Lead score | Remove the non-governed dashboard preview. A real score is deferred to Xaviar evaluation. |
| Deferred goals | Numeric targets, cash rewards, combined scores, and final benchmark cohorts remain future work. |

The detailed implementation-facing record is [DASHBOARD-REVAMP-DECISIONS-v1.0.md](./DASHBOARD-REVAMP-DECISIONS-v1.0.md).
