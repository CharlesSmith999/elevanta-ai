# Gmail one-minute release acceptance

Authority: CRM-DECISIONS-v1.10. No credentials or mailbox addresses in this file.

## Automated checks, 2026-09-22

- PASS: 82 application tests including immediate/one-minute list refresh, overlap suppression, retries and no callbacks after a record is opened/unmounted.
- PASS: API and web TypeScript checks; production web build (existing bundle-size warning remains).
- PASS: all 22 migrations replay in isolated PostgreSQL. Cron/net/Vault are test doubles, not real network workers in this test.
- PASS: disabled intake makes no request; missing secret fails closed; fixed URL and Vault Bearer selected; HTTP 401 tracked as an error; HTTP 200 tracked as delivery, not proof of ingestion.
- PASS: Sales and ordinary service-role callers cannot access private scheduler state or invoke dispatcher. Existing lead permission/idempotency tests remain green.

## Production gates

- Pending: apply migration 202609220001 and verify canonical ledger.
- Pending: job scheduled exactly once, once per minute; consecutive real runs recorded.
- Pending: deploy same Git-reviewed release and verify OAuth configuration is available without exposing values.
- Pending: Google mailbox-owner consent. App is in External Testing; verify reconnect/expiry implications before claiming durable unattended service.
- Pending: authenticated worker HTTP acceptance, fresh Bark message exactly once, Marketing visible / Sales denied, disable/retry checks.

No live mailbox intake is claimed complete until these checks pass. Keep the server activation gate disabled until authorization and release approvals are satisfied.
