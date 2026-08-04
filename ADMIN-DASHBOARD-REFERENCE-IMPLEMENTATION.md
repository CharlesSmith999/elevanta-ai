# Admin Dashboard Reference Implementation

**Version:** v1.0
**Status:** Approved implementation task — 2026-08-04
**Visual source of truth:** `/Users/shariq/Desktop/111.png` (Company Command Center, dark mode)

This task supersedes the previous visual interpretation for the **Admin / Company** dashboard only. It does not change CRM lifecycle rules, permissions, API contracts, Supabase schema, Xaviar scope, or the scheduled Milestone 5 data migration. Other role dashboards are deliberately out of scope until separately revised.

## Required visual structure

1. **Shell and navigation**
   - A compact dark navy left rail with icon-led navigation, command-center selection, settings/help, and an Admin profile area.
   - Top bar title: `Company Command Center`.
   - Period control, source control, dark/light toggle, and profile avatar aligned on the right.

2. **Work now**
   - One framed section below the header with `View all actions`.
   - Six equal metric cards in this exact order: Leads, MQL, SQL, Won, Pipeline Value, Overdue.
   - Each card has an icon tile, large metric, and clear positive/negative change treatment. Safe workspace data must use the real available value or `Not available`; no fabricated production claims.

3. **Performance**
   - Four side-by-side panels: conversion funnel, overdue-follow-ups priority queue, source-quality bars, and sales-execution trend rows.
   - Keep the existing approved data concepts and filters: funnel, overdue work, source-separated quality, and sales execution. Replace only their composition and presentation to match the reference.

4. **Momentum & Recognition**
   - Three panels: top performers, recent wins, and recognition.
   - Use permitted named performance information for the Admin role. Empty/insufficient data must state `Not enough data` rather than invent results.
   - Recognition is visual, in-product-only, and must not imply a combined performance score.

## Visual constraints

- Match the reference’s dense desktop grid, deep navy surfaces, thin indigo borders, purple emphasis, green positive deltas, and amber/red risk states.
- Use the existing icon library for interface icons. Do not use emoji or text-symbol substitutes.
- Dark mode is the fidelity target. Light mode retains the same content and layout with accessible light tokens.
- Existing top-level actions and filters remain functional. `View all` actions may route to their existing permitted pages.

## Acceptance criteria

- The Admin / Company dashboard visibly matches the supplied reference in hierarchy, placement, density, and visual language.
- Existing safe-data calculations, role boundaries, and no-real-data policy remain intact.
- API and Supabase changes are made only if a required displayed value cannot be derived from the existing approved data contract.
- Typecheck, domain tests, production build, and a browser visual comparison against `111.png` pass before release.

## Change control

This document governs the Admin dashboard work until its release is accepted. The previous dashboard task remains the governing plan for role data and privacy rules, but not for the Admin visual layout.

## Light-mode companion reference

The approved Admin light-mode treatment is governed by [`ADMIN-DASHBOARD-LIGHT-REFERENCE-IMPLEMENTATION.md`](./ADMIN-DASHBOARD-LIGHT-REFERENCE-IMPLEMENTATION.md). Dark and light modes share the same layout, widgets, data, and interactions; only the visual token layer changes.
