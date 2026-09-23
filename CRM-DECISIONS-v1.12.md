# Gmail live activation decisions v1.12

Approved by the product owner on 2026-09-23 after confirming Google authorization and explicitly requesting completion of activation.

- Gmail intake may activate independently of the outstanding Xaviar Admin/Manager sign-offs. This supersedes only the Xaviar dependency in v1.8; it does not approve Xaviar itself.
- Enable the existing production server release setting, then activate the connected mailbox through the Admin control. Preserve read-only scope, one-minute scheduling, shared Marketing/Admin research visibility, Sales exclusion, encrypted tokens and duplicate protection.
- Import only qualifying Bark messages received from the activation timestamp. Do not import historical mail, send mail, change labels, alter the parallel Google Sheet, or automatically assign Sales.
- Record successful manual and scheduled Gmail checks separately from actual lead ingestion. A fresh qualifying message must appear once before end-to-end delivery is marked verified. Absence of a fresh message is not a successful ingestion test.
- External Testing still has the documented seven-day refresh-token limit. Activation is not a claim of permanent unattended authorization or Google production verification.
- On worker errors, preserve evidence and investigate; never expose private mailbox details or credentials in public documents. No new infrastructure or paid upgrade is authorized.
