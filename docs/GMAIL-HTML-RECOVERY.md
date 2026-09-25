# Gmail HTML ingestion repair

September 24, 2026: live Admin diagnostics show scheduled sync running with an empty Research queue. The latest 20 message failures all report `plain_text_missing`. The parser accepts only a text/plain MIME body, unlike the spreadsheet's GmailApp.getPlainBody conversion.

Repair scope: accept HTML-only Bark email by converting it to text on the server without rendering HTML, executing scripts, loading images or following links. Preserve sender, activation-time, size, field validation and duplicate protections. Retry only previously failed parser-v1 messages from the current activation window. Never recreate a parsed/published candidate or import pre-activation mail. Record parser version v2 and preserve the original message identity and audit history.

Verification required: HTML-only/nested MIME, entities, scripts, masked values, plain preference, sender and cutoff restrictions, idempotent recovery, production sync and visible recovered Research records.

## Verification and release status

- Live database check confirmed 35 messages in `needs_review` with `plain_text_missing`; no message deletion is needed.
- All 89 automated domain/API/parser tests passed. API/web TypeScript and production build passed.
- All 24 migrations replayed successfully in an isolated PostgreSQL test engine. Research permissions, worker leases, current-activation recovery, exactly-one candidate on repeated recovery, and duplicate protection passed.
- PR48 merged as `ca4396cca839fb2f14d8c541ae7749df3511ad40`; GitHub CI passed and the existing Vercel deployment `CPZPFd7jir2uvPwxn5o6sC8xC2av` succeeded. Migration `202609240001_gmail_html_recovery.sql` was applied afterward and recorded once in the canonical ledger.
- The backlog grew to 82 before release. Live recovery produced 82 parsed messages and 82 visible Research leads, zero pending review, and zero duplicate message groups. Sample detail view preserved masked phone/email, category, credits, address and description.
- Live database role checks returned 82 Research leads for Marketing and zero for Sales. Browser Admin remains unable to execute the ingestion function; service-role worker execution is allowed.
- Repeated sync and the active minute scheduler remained healthy; scheduler HTTP 200 / delivered verified at 2026-09-24 21:13 UTC. No browser console errors were observed.
- Bell component checks passed through `scripts/test-lead-bell.mjs`, including role scope, baseline, pending audio, volume floor and repeat suppression. Live control reached active audio state; speaker loudness and separate-user simultaneous audible delivery were not measured.
