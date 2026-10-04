# Research and Sales connection dashboards

Approved October 3, 2026. Implements the owner's category, research-found, connection, loss-reason and daily-trend graphs before historical workbook import.

## Definitions

- A connection is the first successful Sales activity (Connected, Replied or Meeting Booked) for an opportunity, with an actor and valid assignment interval. MQL/SQL alone and the Research Connected label are not connection evidence. Repeated conversations never add another first connection.
- Sales connection credit belongs to the actor of that first connection. Marketing connection credit belongs to the recorded marketer at research handoff. Company totals count the opportunity once.
- For period connection ratios, the cohort is unique opportunities assigned within the selected date range. Outcomes are measured up to the selected end date. Split connected, attempted without connection and no recorded attempt. Per-Sales rows use assignments to that salesperson and their own recorded work; do not credit a replacement owner with the previous owner's result. Reassignment can put a lead in more than one Sales denominator, so agent denominators are not additive company totals.
- Daily charts use the actual first-connection date, show zero days, and divide by all calendar days displayed for daily averages. MQL/SQL comes from the recorded event snapshot; missing older snapshots are Not available. Use the selected browser timezone and label it.
- First Found means the first save of at least one usable contact method on a research item, excluding confirmed duplicates. Record finder and timestamp once. Do not backdate older items. Prior found items without evidence are reported separately.
- Marketing category comparison uses research received time and App/Web/Game/SMM buckets. SEO/unknown are disclosed as excluded. Research arrivals are a shared queue, not agent-owned work. App received-versus-found is workload by day, not a conversion rate; found dates may differ from received dates.
- Lost reason chart uses recorded Lost/Not Interested transitions within the selected period, with Reason not available for missing reasons. Current terminal records without an event date remain in a missing-evidence count, not a fabricated dated bucket.

## Permissions and UI

Admin sees company results. Marketing managers see their own/direct-report credited results; Marketing agents see their own. Sales managers see their own/direct-report Sales results; Sales agents see their own recorded work. Shared research arrival counts remain visible to Marketing/Admin under the approved shared-queue rule; Sales receive no raw research data. Admin role preview must be scoped by the server. No peer scoreboards for individual agents.

Add an Analytics section to every relevant dashboard, following existing purple/teal theme tokens in light and dark modes. Use bar charts for categories, found-by-agent, connections-by-agent and loss reasons; daily lines/bars for connection trends and App received/found. Include sample sizes, zero/missing states, source/date filters and a handoff attribution table. Client receives aggregated results only, never contact details or raw audit JSON.

## Implementation and validation

Add database triggers for immutable first-found attribution and qualification snapshots in existing activity metadata. Existing schema/data remain intact. Use a narrowly scoped server-only aggregate reader for the current workspace, enforce viewer/team scope before response, paginate data, and never return raw records. This extends the deployment SOP's service-role allowlist to this read-only reporting endpoint. No email or consent changes.

Test duplicate activities, reassignment, wrong actor/interval, MQL without contact, historical missing dates/snapshots, zero days, date/source/category boundaries, role/team/workspace isolation, and empty denominators. Replay migrations locally, then apply through the existing Supabase project and release through GitHub/Vercel. Do not claim production completion before migration, deployment and live role checks pass.

## Test record: October 3, 2026

- PASS: 117 automated application cases, including nine new analytics/endpoint cases; API and web typechecks; production build; whitespace validation.
- PASS: all 27 SQL migrations replayed against isolated PostgreSQL. First-found attribution is written once and protected from overwrite; activity qualification uses the database value rather than client-supplied metadata.
- PASS: unauthenticated/inactive users and non-Admin previews are rejected before privileged reads. Child-table reads use an inner opportunity/workspace join; every query is workspace-constrained and paginated.
- Owner approved server-only table-read grants and deployment. PENDING: production migration verification/ledger, GitHub CI, existing Vercel deployment and live role/theme checks.
- Existing build warning: the main JavaScript bundle exceeds Vite's advisory 500 kB chunk threshold. No build failure.
