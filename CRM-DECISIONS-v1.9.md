# Shared incoming Marketing queue decisions v1.9

Approved by the product owner in this task. Supersedes the research ownership/visibility rules in v1.8 only. All other decisions remain unchanged.

- All active Marketing Agents, Marketing Managers and Admins in the same workspace can see incoming research records, including Sent to Sales records. Both Sales roles are excluded.
- No claim, acceptance or reservation step. Any marketer may add discovered details and explicitly send to an active Sales Agent.
- The marketer completing handoff becomes the normal CRM marketing owner. Manager/Admin handoff retains the last contributing Marketing Agent; it cannot invent attribution.
- Original email evidence is preserved. Published research is read-only. Normal opportunity visibility and workflow remain unchanged.
- Saving an outdated draft must fail clearly rather than overwrite another person's saved work. Sending an outdated draft must also fail. Repeated handoff returns the original opportunity without reassigning it.
- New Gmail messages only from activation; independent of the Google Sheet. No historical backfill, outbound communication or live connection is enabled by this change.

Implementation: additive migration, shared UI scope, revision-checked write API and database regression tests. Existing live-activation gates remain applicable.
