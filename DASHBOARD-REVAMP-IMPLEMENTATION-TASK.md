# Dashboard Revamp Implementation Task

**Version:** v1.1
**Approved:** 2026-08-04; responsive remediation approved 2026-08-17
**Source of truth:** `DASHBOARD-REVAMP-DECISIONS-v1.0.md`, `DASHBOARD-ROLE-SCREEN-SPEC-v1.0.md`, `docs/DASHBOARD-REVAMP-DESIGN-SET.md`, and `audit/uiux-2026-08-17/UI-UX-AUDIT.md`

**Later approved lead-flow delta:** `CRM-DECISIONS-v1.6.md` and `LEAD-WORKFLOW-SPEC-v1.0.md` supersede manual Sales Acceptance and require a separate implementation/test release. This completed dashboard task remains the historical visual baseline.

**Approved visual implementation:** [ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md](./ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md) remains the Admin / Company source of truth. [ROLE-DASHBOARD-REFERENCE-IMPLEMENTATION.md](./ROLE-DASHBOARD-REFERENCE-IMPLEMENTATION.md) is the implementation contract for Marketing Manager, Sales Manager, Marketing Agent, and Sales Agent.

## Objective

Implement the selected Direction 1 dashboard experience for all five current roles, with matching dark and light layouts, theme-aware chart colors, and role-appropriate decision support.

## Approved scope

- Keep one compact `View as` selector in the top bar of every safe test-workspace dashboard so all five approved role contexts can be inspected without leaving the dashboard.
- Show only working, permission-appropriate destinations in each role sidebar; do not expose placeholder navigation items.

- Roles: Admin, Marketing Manager, Sales Manager, Marketing Agent, Sales Agent.
- Shared order: Work now → Performance → Improve → Recognition.
- Shared controls: Today, Week, Month, Year, Lifetime, and Custom period; source/status filters; visible scope; drill-through actions.
- Admin: business pulse, operating risks, company funnel, source quality, sales execution, and recognition.
- Marketing Manager: the released baseline contains routing/acceptance; the v1.6 delta will replace acceptance with first Sales work, Sales Engagement, and SQL evidence.
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

## 2026-08-17 responsive and navigation remediation

The production audit found that the approved role dashboards and the remaining CRM pages use separate application shells. It also confirmed that the sidebar disappears below 860 px without a replacement menu. This remediation does not change approved business metrics, permissions, roles, or workflows. It corrects the implementation so the existing decisions work consistently on every screen.

### Required implementation

- [x] Use one role-aware application shell and one navigation contract on Dashboard, Lead inbox, Lead detail, Follow-ups, Assignments/Handoffs, Reports, Benchmark Board, Leaderboard/My standing, Data quality, Review queue, User management, and Xaviar.
- [x] Preserve the same permitted navigation destinations for a role when moving between pages.
- [x] Add a labelled mobile navigation control before hiding the desktop sidebar.
- [x] Keep the current page visibly selected and provide a reliable return to the role dashboard.
- [x] Use the same theme control, typography scale, spacing, colour tokens, border system, and focus treatment on dashboards and internal pages.
- [x] Prevent document-level horizontal overflow in filters, tables, priority queues, and forms.
- [x] Use phone-friendly list/card presentations for wide tables while preserving the desktop table.
- [x] Increase compact-screen interaction targets and essential helper text to readable sizes.
- [x] Give every chart an accessible name and a visible or screen-reader-readable data summary.
- [x] Group Lead detail into task-focused sections with progressive disclosure without changing the existing form data contract.
- [x] Make the Admin `Improve` action open Xaviar, not Reports.
- [x] Complete final released-environment verification at phone, tablet, laptop, and wide-desktop widths in both themes.

### Acceptance rule

The remediation is complete only when every role keeps the same navigation between Dashboard and internal pages, no required page becomes unreachable at compact width, and the test matrix passes without document-level horizontal overflow.

### Local implementation evidence, 2026-08-17

- One shared role navigation contract now drives Admin, Marketing Manager, Sales Manager, Marketing Agent, and Sales Agent sidebars on dashboards and internal pages.
- Forty-one role/page navigation cases passed in the local browser with no document-level overflow at the available 1280 × 720 viewport.
- Ten dashboard theme cases confirmed identical card, chart, and heading counts in light and dark modes.
- The responsive drawer, touch-target, table-card, filter, typography, and overflow rules are implemented at the approved compact breakpoints. Final multi-viewport released-environment screenshots remain the last release gate.
- All 46 CRM, permission, navigation, privacy, and Xaviar tests passed. Web TypeScript and the production build passed.

### Production release evidence, 2026-08-20

- PR #31 passed GitHub Actions run 263 and was squash-merged as `ce5f00885d7209abdaef1b64925479a68089d19e`.
- Vercel production deployment completed through the existing Git-connected project.
- Production web and API health checks returned HTTP 200.
- The five-role dark/light tablet matrix passed with two-column headline metrics and no document-level horizontal overflow. Phone remains single-column; laptop and wide-desktop layouts retain the approved composition.

## Change control

Any scope or metric change requires a new decision/document version before implementation. This task does not authorize importing the production workbook or starting Xaviar development.
