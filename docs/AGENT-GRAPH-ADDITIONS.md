# Agent graph additions, October 5, 2026

Owner requested adding these graphs before removing existing dashboard sections and before Milestone 5 data import. This extends CONNECTION-DASHBOARDS.md; existing graphs remain during this step.

## Marketing

- Lost / Not Interested reasons: retain the existing dated-event graph.
- Total App research arrivals by day: dedicated daily bar chart.
- App versus all other research arrivals by day: all other includes Web, Game, SMM, SEO and unclassified arrivals.
- Research progress: show shared arrivals and not-yet-found workload separately from the viewer's found, routed and connected results. The personal stages use the same received-in-period cohort, measured through the selected end date. Show finder names and the first connecting salesperson for the viewer's own research handoffs; do not expose unrelated peer performance.
- App found versus connected: daily workload comparison using first-found date and first-connection date. This is not a conversion rate because the events may involve different arrival cohorts.
- Found versus received: daily all-category comparison of shared arrivals and scoped discoveries. Keep the existing App-only comparison as well.

## Sales

- Leads received versus connected: unique assignment cohort in the period, using the existing recorded first-connection attribution.
- Connected versus Won (converted): use leads first connected in the period, and dated Won status transitions after connection through the selected end. Personal Sales views count wins by the same Sales Agent under a valid assignment; show wins by another agent separately. Repeated win events count once. A Won status without dated evidence is not invented. Converted is provisionally interpreted as Won and therefore uses one comparison, not two identical graphs.
- Lost / Not Interested reasons: retain the existing graph.

## Data and verification

Use existing research, activity and assignment records; no database migration or permission expansion is required. Respect source, date, timezone, workspace and role scope. Confirmed duplicate research is excluded from discovery/progress; received volume still reflects arrivals. Missing discovery evidence is labeled unknown, not counted as proven not found. Shared arrivals are never labeled personal output. Zero-data charts explain what recorded action supplies them. Do not seed production performance data to fill graphs.

Test category totals, zero days, date/timezone edges, duplicate research, attribution, research received-cohort progress, repeated win events, wins before connection/outside the period, invalid actors/assignments, reassignment and Sales research isolation. Run API/web type checks and a production build.

Validation: 123 automated application tests passed, including six new analytics cases covering category reconciliation, finder/connector attribution, arrival cohorts, dated Won evidence, reassignment and visibility. API/web type checks and production build passed. Browser preview verified populated Marketing charts, named funnel values, Sales comparisons in dark mode, and explicit empty Sales states using local synthetic fixtures. No production records were added. Temporary preview files were removed after review.

Release state: implemented and verified locally; owner approved publication through the existing GitHub/Vercel pipeline. Release verification is pending. Existing graphs remain for the owner's next removal/layout review. Milestone 5 import has not started. The existing large JavaScript bundle advisory remains.
