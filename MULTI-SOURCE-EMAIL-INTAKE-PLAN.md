# Elevanta AI: Multi-Source Email Intake Plan

Status: Planned, not implemented
Date: 2026-10-18

## Objective

Receive Bark, Thumbtack, and Clutch lead emails through one central intake mailbox and send each lead into the existing Elevanta AI Marketing Research workflow.

## Approved approach

Create one central mailbox, such as `leads@yourdomain.com`. Configure forwarding rules in the Bark, Thumbtack, and Clutch mailboxes. The CRM will connect only to the central mailbox through secure OAuth.

Preferred source identification:

```text
leads+bark@yourdomain.com
leads+thumbtack@yourdomain.com
leads+clutch@yourdomain.com
```

If source aliases are not supported, forwarding rules should add a subject prefix:

```text
[BARK] New lead
[THUMBTACK] New lead
[CLUTCH] New lead
```

## Processing flow

1. The central mailbox receives a forwarded message.
2. Elevanta AI identifies the source from the receiving alias, subject prefix, sender, or forwarding headers.
3. The parser extracts the name, phone, email, service, message, received date, and original email metadata.
4. The CRM normalizes phone numbers and email addresses.
5. Duplicate checks run against existing contacts and opportunities.
6. The message enters the Marketing Research queue with the source attached.
7. Marketing reviews and publishes the lead to Sales using the existing workflow.
8. The original email remains available as evidence for audit and correction.

## Safety rules

- Do not share mailbox passwords with the CRM team.
- Use OAuth or an approved forwarding rule.
- Keep the three original source inboxes active.
- Do not forward CRM-generated replies back into the intake mailbox.
- Reject or quarantine messages with no usable name plus phone or email.
- Preserve the original source and message even when the lead is a duplicate or needs review.
- Prevent the same message from being imported twice using provider message ID and a source-specific fingerprint.

## Test plan before activation

Send one real or safe test email from each source and verify:

- Source is identified correctly.
- Name, phone, email, and service are extracted correctly.
- The original message is preserved.
- Duplicate detection behaves correctly.
- The lead appears only in the Marketing Research queue.
- No forwarding loop occurs.
- A Marketing user can publish the lead to Sales.

## Required inputs before implementation

- Central mailbox address.
- Mail provider: Google Workspace/Gmail or Microsoft 365/Outlook.
- Forwarding confirmation for Bark, Thumbtack, and Clutch.
- One safe test email from each source.
- Decision on aliases versus subject prefixes if both are available.

## Out of scope for this plan

- Direct API integrations with Bark, Thumbtack, or Clutch.
- Automatic outbound email, SMS, or calling.
- Changing lead ownership, status rules, or duplicate-review rules.
