# Research arrivals visibility

Approved by the owner on October 1, 2026 after live diagnosis confirmed successful intake but poor list visibility.

## Contract

- Sort the research list by original email received time, newest first. Use record ID as a deterministic tie-breaker; missing/invalid dates go last. Never mutate or delete records while sorting.
- Show a clearly labeled recent-arrivals count for emails received in the last 24 hours, not an unread count. Future/invalid timestamps are not recent arrivals.
- Provide a one-click recent-arrivals view that clears conflicting filters and highlights recent rows. Preserve existing research workflows, masked contacts and Marketing/Admin permissions.
- Do not overwrite open drafts, change Gmail scopes, change database records or change Sales access. No database migration is needed.

## Acceptance

- Tests: unsorted/replayed records, tied dates, invalid/missing/future dates, exact 24-hour boundary, input immutability and zero recent arrivals.
- Web typecheck, application tests and production build pass.
- Existing GitHub/Vercel pipeline only. Live acceptance: research count is preserved, most recently received email is first, recent-arrivals control works and existing filters remain usable.

Status: implemented; 100 application tests passed, web typecheck and production build passed. Production deployment and live acceptance pending. Initial local test-server restrictions were resolved by rerunning the unchanged suite with local server access; zero test failures remain.
