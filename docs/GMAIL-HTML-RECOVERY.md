# Gmail HTML ingestion repair

September 24, 2026: live Admin diagnostics show scheduled sync running with an empty Research queue. The latest 20 message failures all report `plain_text_missing`. The parser accepts only a text/plain MIME body, unlike the spreadsheet's GmailApp.getPlainBody conversion.

Repair scope: accept HTML-only Bark email by converting it to text on the server without rendering HTML, executing scripts, loading images or following links. Preserve sender, activation-time, size, field validation and duplicate protections. Retry only previously failed parser-v1 messages from the current activation window. Never recreate a parsed/published candidate or import pre-activation mail. Record parser version v2 and preserve the original message identity and audit history.

Verification required: HTML-only/nested MIME, entities, scripts, masked values, plain preference, sender and cutoff restrictions, idempotent recovery, production sync and visible recovered Research records.

## Verification and release status

- Live database check confirmed 35 messages in `needs_review` with `plain_text_missing`; no message deletion is needed.
- All 89 automated domain/API/parser tests passed. API/web TypeScript and production build passed.
- All 24 migrations replayed successfully in an isolated PostgreSQL test engine. Research permissions, worker leases, current-activation recovery, exactly-one candidate on repeated recovery, and duplicate protection passed.
- Deployment pending GitHub access. Apply `202609240001_gmail_html_recovery.sql` only AFTER the v2 application is deployed. This resets the scan to the existing activation date and retries legacy failed messages without including older mail.
- Production recovery and audible browser acceptance are still pending. Local tests are not evidence that live leads have recovered.
