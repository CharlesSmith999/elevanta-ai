# Elevanta AI — Confirmed Foundation Decisions v1.1

Status: Approved by product owner

This decision record extends the approved baseline in [CRM-PLAN.md](./CRM-PLAN.md). Where this document differs from an open decision in the baseline, this approved decision takes precedence.

| Decision | Approved choice |
|---|---|
| Deployment | Vercel hosts the web application and Node API. Supabase hosts PostgreSQL, authentication, and storage. GitHub Pages is not used for the application. |
| Authentication | Email and password through Supabase Auth for Phase 1. |
| Manager hierarchy | Each agent has one manager in Phase 1. Multi-manager relationships are deferred. |
| Marketing access | Marketing is a distinct CRM role, with the permissions described in the baseline plan. |
| Initial review admin | Shariq is the initial administrator for duplicate and incorrect-lead reviews. |

## What this unlocks

Milestone 1 can begin: project setup, Supabase database migrations, authentication, role and manager hierarchy, row-level security, audit-event foundations, and initial application screens.

## Still deferred

Automated email, SMS, calls, public SaaS billing, and multi-tenant self-service remain outside Phase 1.
