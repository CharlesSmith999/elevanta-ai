# Gmail one-minute release acceptance

Authority: CRM-DECISIONS-v1.10. No credentials or mailbox addresses in this file.

## Automated checks, 2026-09-22

- PASS: 82 application tests including immediate/one-minute list refresh, overlap suppression, retries and no callbacks after a record is opened/unmounted.
- PASS: API and web TypeScript checks; production web build (existing bundle-size warning remains).
- PASS: all 22 migrations replay in isolated PostgreSQL. Cron/net/Vault are test doubles, not real network workers in this test.
- PASS: disabled intake makes no request; missing secret fails closed; fixed URL and Vault Bearer selected; HTTP 401 tracked as an error; HTTP 200 tracked as delivery, not proof of ingestion.
- PASS: Sales and ordinary service-role callers cannot access private scheduler state or invoke dispatcher. Existing lead permission/idempotency tests remain green.

## Production gates

- PASS: migration 202609220001 applied and canonical ledger count verified as one; private state also has RLS enabled.
- PASS: exactly one active minute job. Successful runs at 00:48, 00:49 and 00:50 UTC on 2026-09-23. State intake_disabled, enabled mailbox count zero. These prove scheduling, not Gmail ingestion.
- PASS: PR45 merged as 5932b6af617828b437b2f16854e8dd9bf5be12a7. Production deployment 4SrYFWkaRyi3ukVTXK6BGzRbgbug is Ready. GitHub run319 passed. Live page shows minute schedule and draft-safe refresh copy; authorization button is enabled. Health/readiness pass; no browser console errors observed.
- PASS: a diagnostic pg_net call to the fixed worker with the Vault credential returned HTTP200, no timeout, body {"state":"idle"}. No mailbox enabled or read by this check.
- Pending: Google mailbox-owner consent. App is in External Testing; verify reconnect/expiry implications before claiming durable unattended service.
- Pending: authenticated worker HTTP acceptance, fresh Bark message exactly once, Marketing visible / Sales denied, disable/retry checks.

No live mailbox intake is claimed complete until these checks pass. Keep the server activation gate disabled until authorization and release approvals are satisfied.

Google configuration verified: the designated mailbox appears as the sole test-user entry; only gmail.readonly is saved. External Testing refresh tokens expire after seven days for Gmail scopes, per [Google OAuth documentation](https://developers.google.com/identity/protocols/oauth2#expiration). Initial consent therefore does not establish a permanent unattended production integration. Production publishing/verification remains separate work before durable acceptance.
