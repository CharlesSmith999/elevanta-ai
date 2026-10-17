# Simple calling view, v1.23

Approved by the owner on October 16, 2026 after reviewing and simplifying the calling concept.

- Add an optional Calling view beside the existing Lead view. Keep existing lead detail, research, assignment, dashboard and import flows.
- One working row per opportunity/phone method: lead name, requested service, last call result, prominent Call, Copy, Log result and Details. Do not display phone numbers, primary/secondary labels, or a time column.
- To Call, Called Today and Follow-up Needed tabs. Filter by the number's latest call result and service. Most recent assignment first.
- Saving a result moves that number out of To Call for the current local day, only after the server confirms success. Future follow-ups wait until due. Completed history remains in the lead activity log.
- Normal outcomes need one result click. Callback requires a future date/time. Not Interested requires an existing loss reason. Wrong Number removes only that contact method. Optional notes are available before choosing an outcome.
- Reuse the existing activity and contact-quality rules. All writes require the actual signed-in current Sales Agent owner. Do not fabricate calls from clicking Dial or Copy. Preserve MQL/SQL and advanced lifecycle stages on unsuccessful attempts.
- Show logged attempts, unique numbers, connected outcomes and connection rate for the selected day. These are manually reported results, not provider-verified call telemetry.
- Daily figures cover records visible in this calling view; connected outcomes mean Connected or Meeting booked. Agent figures filter by the actual recording agent. Reassignment may reduce an agent's visible historical scope; existing management reporting remains the broader source for team attribution.
- Usable unverified numbers are included; incorrect, wrong-person, restricted and removed methods cannot be called. Paused, Incorrect, Duplicate and Do Not Contact opportunities cannot be called.
- Desktop calling uses the configured phone application. Dialpad, Zoom Phone and Vonage remain external; no provider credentials or automatic call monitoring are introduced.
- Filtered download uses server-authorized scope, excludes blocked contact methods, and records an audit event.
- A new additive transaction wrapper saves call results, required status/reason or contact assessment and follow-up together, with retry protection. It does not replace existing RPCs or rewrite historical records. Corrections must preserve history rather than erase a saved activity.

This supersedes the detail-only UI limit in v1.19 for the optional Calling view. The earlier full-screen calling queue proposal is not implemented.
