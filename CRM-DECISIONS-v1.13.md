# Lead arrival bell decisions v1.13

Approved by the product owner on 2026-09-23.

## Purpose

The CRM must draw immediate attention to newly available work without requiring users to keep refreshing a list.

## Alert rules

- A new item entering the shared Lead Research Queue plays a bell for signed-in Marketing Agents, the Marketing Manager, and Admin.
- A new active assignment plays a bell only for the signed-in Sales Agent who received that lead.
- Existing records establish the initial baseline and do not create a burst of alerts when a user signs in or reloads the CRM.
- One detected batch plays one bell and shows the number of new leads. The same event is claimed in browser storage to reduce duplicate sound from multiple open tabs.
- The Research Queue is refreshed after a new Research lead is detected. A Sales Agent's lead list is refreshed after a new assignment is detected.

## Sound and user experience

- The CRM provides a visible bell-volume control and a Test bell action for eligible roles.
- The default volume is 85%. Users may reduce it to 15%, but the CRM does not provide a mute or zero-volume option.
- The bell uses an application-generated sound. No personal lead information is spoken or included in the sound.
- Browsers require a user interaction before website audio can start. If an alert arrives before that interaction, the CRM keeps one pending bell and plays it after the next click or key press.
- The CRM cannot override operating-system volume, browser autoplay rules, or a browser tab that the user manually mutes.

## Delivery boundary

- Phase 1 uses the existing authenticated CRM APIs and a 15-second in-app check while the CRM is open.
- This is not an operating-system push notification. Alerts while the browser is closed, mobile push, quiet hours, and user-specific alert policy are future work.
- The feature does not change Gmail intake, lead routing, permissions, or assignment history.

## Security and privacy

- Research alerts are never queried by Sales roles.
- Assignment alerts use the Sales Agent's existing role-scoped lead response.
- The visual alert contains only a count and destination. It does not expose masked lead data, contact details, or another agent's assignment.
