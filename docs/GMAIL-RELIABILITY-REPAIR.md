# Gmail reliability repair

Owner requested completion on October 1, 2026. Confirmed operator: Muhammad Shariq. Public privacy/support contact: charlestsmith999@gmail.com.

## Repair scope

- Keep read-only Gmail, Admin-only settings, Marketing research access and Sales exclusion.
- Same-mailbox reauthorization preserves the approved activation timestamp and scan checkpoint. Resume retains both; first activation and mailbox replacement start a new window.
- Preserve browser-bound OAuth state, active Admin checks, encrypted tokens and settings-revision checks.
- Clear stale pagination on reconnect and replay from the checkpoint. Existing provider-message IDs prevent duplicates.
- Recover outage messages only within the originally approved activation window, never earlier historical mail.
- Prepare accurate public disclosures for owner approval. Google publishing and verification are separate steps; Testing-issued tokens are not permanent.

## Acceptance checklist

- First activation creates a current-time window; resume preserves it across long outages.
- Reconnect retains dates and clears stale pagination/leases.
- Concurrent replacement or activation change rejects stale updates.
- Missing tokens/database errors fail closed; missing/mismatched OAuth cookie is rejected.
- Replay retains duplicate protection and pre-activation filtering.
- Application tests, typechecks and build pass; live readiness and scheduled sync pass after release.

## Existing live evidence

October 1: same-browser owner consent succeeded. Manual sync at 20:43:45 UTC and scheduled sync at 20:45 UTC succeeded. Research increased from 495 to 496. Earlier outage recovery is unverified because the previous callback reset the window.
