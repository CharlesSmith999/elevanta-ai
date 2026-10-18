# CRM Decisions v1.24: Admin calling test mode

Approved by Shariq on October 18, 2026.

- Admins can see and test Call and Log result in the Calling view while previewing a Sales Agent.
- Admin actions are attributed to the authenticated Admin account, never to the previewed agent.
- Sales Agent actions still require the current assignment and are attributed to that agent.
- Existing activity history, contact restrictions, wrong-number handling, callbacks, loss reasons and idempotency remain unchanged.
- The Calling view must display a visible note that Admin test actions are recorded under the Admin account.
- Manager and Marketing roles remain read-only for calling.

This supersedes the Admin read-only restriction for Calling view actions in v1.23 only. It does not grant Admin impersonation or alter agent performance reporting.
