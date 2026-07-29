# Elevanta AI — Xaviar Operating Model Decisions v1.2

Status: Approved by product owner

This decision record extends `CRM-DECISIONS-v1.1.md` and the baseline in `CRM-PLAN.md`.

## Approved direction

| Decision | Proposed rule |
|---|---|
| Xaviar’s role | Xaviar is an embedded, role-aware coach inside every dashboard and lead workflow, not only a reporting widget. |
| Coaching loop | Xaviar explains, diagnoses, recommends, coaches, monitors improvement, and later assists with approved actions. |
| Historical analysis | Xaviar can compare daily, weekly, monthly, and lifetime performance. |
| Forecasting | Xaviar can predict connection, qualification, conversion, follow-up risk, and lead-quality trends, with evidence and uncertainty shown. |
| Best-practice benchmarking | Xaviar may identify anonymized, permission-safe patterns from strong performers by skill, such as follow-up or proposal-to-close conversion. |
| Human control | In Phase 1 Xaviar is advisory: it cannot silently change records, delete/merge leads, reassign ownership, or send outbound messages. |
| Phase 2 follow-through | Xaviar may track whether recommendations were followed and send reminders/escalations, subject to role permissions and manager visibility. |
| Phase 2 communication | Email, SMS, calendar, phone, and eventually approved AI-assisted outreach require consent, unsubscribe handling, audit logs, and human approval gates. |

## Role outcomes

- Sales agents receive personalized prioritization, next actions, follow-up coaching, conversion coaching, and best-practice guidance.
- Marketers receive source-quality, targeting, duplicate-prevention, and routing coaching.
- Managers receive skill-based team benchmarks, coaching plans, improvement tracking, and risk alerts.
- Admins receive organization-wide forecasts, bottleneck analysis, data-quality risks, and leadership reports.

## Safety and privacy

Xaviar must cite the CRM events supporting recommendations, keep advice and outcomes for improvement tracking, respect role-based visibility, and avoid exposing another person’s private contact data. Human review remains required for incorrect/duplicate decisions and all outbound communication until a later approved decision.
