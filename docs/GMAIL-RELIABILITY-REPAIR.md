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

## Release evidence

Google Branding links saved and Audience switched to In production with the owner's explicit warning approval. Verification Center still reports branding/data access unverified. The owner completed fresh Production-mode consent on October 1. Intake was resumed and the live CRM showed Automatic intake enabled and Sync completed at 5:12:04 PM America/New_York. Later database checks below confirm outage recovery. This is not a guarantee against future Google revocation.

PR53 merged as `5010f9e1e43f3ba25e54ae0a6bfe2fa04b2bdde4`. GitHub Actions run337 passed. Existing Vercel production deployment `4iLLdfKc7t2TTq7kuX6KToCKKmCz` succeeded. Live API health/readiness and public homepage/privacy/CSS checks passed. No database schema migration was needed.

## Remaining acceptance and blockers

Website ownership verified by Google Search Console on October 1, 2026 at approximately 21:35 UTC using the exact HTML file. PR54 merged as `e9206ea49fb35c4ff76c61703c98f3acb9c43595`; CI run339 and existing Vercel production deployment `ECKEE5j5cCQ4d5WPx64g81Dh5fKV` passed. Live verification file and API health returned successfully. Google instructs waiting 24 hours after ownership before retrying Branding, so retry no earlier than October 2 at approximately 21:35 UTC. Restricted Gmail review is still outstanding. This final ownership evidence is saved locally for the next grouped documentation release.

Latest acceptance supersedes the earlier outage/access entries: Supabase access restored. Exact guarded checkpoint repair applied with one audit event. At 21:24:02.998 UTC, scheduled sync completed with no error and no pending pages. Database integrity: 608 messages, 608 research candidates, 608 distinct provider IDs, zero unresolved outcomes. Of these, 108 were received in the outage window and ingested during recovery. Existing row security on audit_events and gmail_connections remains enabled.

Google automated branding check failed because homepage ownership is not verified. Existing URL-prefix property was added to Search Console under the Google Cloud owner account. Google supplied `google7908c4a709a1821d.html`; deploying that exact file is the next step. Once ownership succeeds, Google's issue screen instructs waiting 24 hours before branding retry. No consent scopes or CRM permissions change.

- Supabase access was restored by the owner. No credential or two-factor changes were performed by the agent.
- Recovery procedure: read the exact workspace connection without selecting token ciphertext; verify mailbox/settings revision, approved activation and current checkpoint. Restore only the originally approved intake window and replay from the observed last pre-outage successful sync with overlap. Clear stale pagination/lease with concurrency guards. Run intake, then verify durable ingestion outcomes, duplicate protection and later scheduled success. Do not broaden into pre-activation historical mail or claim recovery from a queue count alone.
- Google verification is separate from Production mode. Confirm authorized-domain ownership, verify and publish branding, then prepare restricted-scope justification and a demonstration of consent/intake. Review policy compliance and any security-assessment requirement before submitting assertions. No invented exemption or compliance claim, paid assessment commitment, or unapproved policy promise.
- Public privacy/homepage are live. Scope justification: Gmail read-only is needed to list and read Bark message bodies; metadata-only access cannot extract the supplied lead request. No sending, mailbox modifications or additional scope is required.
- Full Google verification cannot be completed solely by changing the Audience toggle. Google's review is external. Official requirements: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Follow-up documentation edits are local and have not been published as a separate release.
