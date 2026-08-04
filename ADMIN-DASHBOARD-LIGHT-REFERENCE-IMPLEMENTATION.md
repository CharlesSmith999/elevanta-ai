# Admin Dashboard Light Reference Implementation

**Status:** Approved for implementation

**Date:** 2026-08-04

## Governing reference

The visual source of truth for the Admin / Company dashboard in light mode is:

`/Users/shariq/Desktop/Codex Image Aug 4, 2026, 02_25_50 PM.png`

This document extends `ADMIN-DASHBOARD-REFERENCE-IMPLEMENTATION.md`. It does not change the Admin dashboard's information architecture, widget contract, permissions, filters, or data rules.

## Required light-mode composition

The light-mode Admin dashboard must preserve the exact dark-mode structure:

1. Compact left navigation and Company Command Center header.
2. Six Work now cards: Leads, MQL, SQL, Won, Pipeline Value, and Overdue.
3. Four Performance panels: Conversion funnel, Overdue follow-ups, Source quality, and Sales execution.
4. Three Momentum & Recognition panels: Top performers, Recent wins, and Recognition.

## Required visual treatment

- White application canvas and white sidebar.
- Very light gray/lavender panel surfaces.
- Pale lavender active-navigation background with purple text and icon.
- Dark navy primary text and cool gray secondary text.
- Thin cool-gray borders and restrained shadows.
- Purple links and section headings.
- Purple, blue, teal, green, amber, and red semantic accents matching the approved reference.
- Recognition badges retain the same three identities and use vivid purple, blue, and teal treatments.
- Dark and light modes render the same controls, charts, widgets, data, and actions.

## Data and behavior rules

- All displayed values continue to use existing CRM data and role-safe calculations.
- Do not copy the reference image's example company figures into the application.
- Period, source, theme, navigation, and action controls remain functional.
- No backend, API, Supabase schema, or real-data migration change is required.
- Other role dashboards remain unchanged.

## Acceptance gate

- Compare the reference and rendered Admin light-mode screen at the same viewport.
- Verify the entire screen in one comparison input.
- Pass TypeScript checks, the domain test suite, production build, light/dark theme parity, filters, and navigation.
- Record the final result in `design-qa.md` before release.
