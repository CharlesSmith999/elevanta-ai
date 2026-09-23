# Gmail one-minute intake decisions v1.10

Approved by the owner: check the designated Gmail inbox every minute. This supersedes daily intake and the proposed five-minute interval. The mailbox address is stored privately in Admin settings, not committed to this public repository. Outlook is not part of this change.

- Poll Gmail on a server-side one-minute schedule, independent of whether a browser is open. This is a target checking interval, not a guaranteed delivery deadline.
- Retain direct Gmail-to-CRM intake, new messages only from activation, read-only Gmail scope, masked source evidence, shared Marketing/Admin visibility and Sales exclusion from v1.9.
- Auto-refresh the research list without losing an open research draft. Revision conflicts must remain explicit; background refresh must not silently replace an agent's unsaved work.
- Preserve worker leases, duplicate-message protection, retry handling, parser review and recorded sync health. Never log tokens or publish mailbox details in Git.
- Gmail push notifications are not required for this iteration; the latest explicit instruction is one-minute checking.
- The current Vercel team is Hobby, verified in its dashboard. Its native scheduler cannot satisfy this interval. Do not deploy an unsupported minute cron or purchase an upgrade without approval. Confirm an approved supported scheduler before activation, using existing infrastructure where practical.
- Obtain Google account consent and required credentials securely. Do not treat an address saved in the CRM as authorization.
- Release acceptance requires successful scheduled checks on consecutive minute boundaries, a newly received Bark message appearing once in the research queue, safe UI refresh, role restrictions, and disable/retry behavior. Until verified, label the connection inactive or pending, not live.

Implementation and remaining setup: [GMAIL-INTAKE-IMPLEMENTATION.md](./docs/GMAIL-INTAKE-IMPLEMENTATION.md).
