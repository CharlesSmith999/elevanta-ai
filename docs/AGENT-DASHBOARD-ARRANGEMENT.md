# Agent dashboard arrangement

Approved implementation refinement: October 5, 2026. This document applies the existing role screen specification and the approved connection analytics rules. It does not change permissions, metric definitions, or data collection.

## Sales Agent

1. **Work now:** today's prioritized task queue, then a short execution summary for open work, follow-ups, response time, and follow-up completion.
2. **Performance:** conversion path, first-connection summary and daily trend, then loss reasons. Use recorded successful contact events for first-connection figures. Keep status-based pipeline stages distinct from activity-based connection evidence.
3. **Improve:** personalized growth actions based on available records. If there is not enough evidence, say so.
4. **Recognition:** private, non-ranked recognition last.

Do not show marketer, other Sales Agent, or company comparison tables on an individual Sales Agent dashboard. Keep those comparisons in department/Company views.

## Marketing Agent

1. **Work now:** Add Lead remains prominent, followed by the quality-action queue and concise quality measures. Label assignment coverage as **Routed to Sales**, not acceptance.
2. **Performance:** the impact path, project-type arrivals, App received-versus-found workload, first Sales connections credited to the marketer's opportunities, and relevant loss reasons. The impact path must not invent an acceptance step; use only recorded stages and activity evidence.
3. **Improve:** source learning and private, evidence-backed growth guidance.
4. **Recognition:** private, non-ranked recognition last.

Do not show a one-person leaderboard or peer comparison table to an individual marketer. Keep team comparisons in manager/Company views.

## Shared presentation rules

- Keep the existing date and source filters. Every card and chart must follow them.
- Use personal/team-scoped server aggregates. Never expose raw Research rows or contact details through analytics.
- Place actual-event charts before growth and recognition. Keep recovery/recognition sections after actionable performance.
- Clearly distinguish a current lifecycle status from an auditable activity event. A historical status is not proof of a dated first connection.
- Retain zero values and explicit missing-evidence states; do not fill gaps with estimates.
- This is a dashboard layout refinement only. It does not add database fields, migration requirements, or new user permissions.
