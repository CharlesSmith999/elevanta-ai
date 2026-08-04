# Dashboard Revamp Implementation Task

**Version:** v1.0
**Approved:** 2026-08-04
**Source of truth:** `DASHBOARD-REVAMP-DECISIONS-v1.0.md`, `DASHBOARD-ROLE-SCREEN-SPEC-v1.0.md`, and `docs/DASHBOARD-REVAMP-DESIGN-SET.md`

**Admin visual override:** [ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md](./ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md) is the current visual source of truth for the Admin / Company dashboard. It intentionally replaces the earlier Admin visual interpretation while leaving all other role dashboards unchanged for now.

## Objective

Implement the selected Direction 1 dashboard experience for all five current roles, with matching dark and light layouts, theme-aware chart colors, and role-appropriate decision support.

## Approved scope

- Roles: Admin, Marketing Manager, Sales Manager, Marketing Agent, Sales Agent.
- Shared order: Work now → Performance → Improve → Recognition.
- Shared controls: Today, Week, Month, Year, Lifetime, and Custom period; source/status filters; visible scope; drill-through actions.
- Admin: business pulse, operating risks, company funnel, source quality, sales execution, and recognition.
- Marketing Manager: team quality pulse, quality-risk queue, routing/acceptance funnel, source quality, coaching, and named direct-report recognition.
- Sales Manager: execution pulse, operating watchlist, sales funnel, workload/follow-up discipline, loss/recovery, and named direct-report recognition.
- Marketing Agent: prominent Add lead action, quality queue, quality cards, source learning, private growth, and private recognition.
- Sales Agent: today priority queue, execution cards, conversion path, loss learning, personal growth, and private recognition.
- All role screens must preserve the same information and chart elements when switching between dark and light mode. Only presentation tokens change.
- Missing or statistically insufficient data must render as `Not available` or `Not enough data`; no invented performance claims.

## Explicit exclusions

Combined score, lead-score preview, close prediction, universal cross-source ranking, communication/call-quality scoring, targets, and Xaviar coaching automation remain out of this implementation.

## Delivery checklist

- [x] Update role-aware dashboard hierarchy and content.
- [x] Apply the selected visual system and responsive spacing.
- [x] Verify chart/card parity in code across all roles and both themes.
- [x] Verify filters, Add lead, Lead inbox, leaderboard, watchlist, and drill-through actions in the existing component contracts.
- [x] Run typecheck, build, and domain tests; record browser QA status in `design-qa.md`.
- [x] Update `PROJECT-STATUS.md` and related dashboard documents with evidence.
- [x] Complete live browser visual QA after release.
- [x] Publish only after local checks pass and the release is reconciled with `CRM-PLAN.md` and the current decisions document.

## Change control

Any scope or metric change requires a new decision/document version before implementation. This task does not authorize importing the production workbook or starting Xaviar development.
