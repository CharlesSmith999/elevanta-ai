# Sales loss reason and assignment-first inbox, v1.21

Approved by the owner on October 15, 2026.

- Selecting `Lost` in the Sales lifecycle must reveal a required controlled loss-reason field on the same screen.
- The opportunity remains in its current status until the Sales Agent chooses a reason and confirms the change.
- The confirmed status and loss reason are saved together and retained in activity history.
- The Sales Agent lead list defaults to the current assignment date, newest assignment first.
- Lead creation date and assignment date remain separate. Reassigning an older lead brings it to the top of the new Sales Agent's list without changing its creation date.
- Sales users may still choose follow-up urgency or name sorting when needed.

This change uses existing opportunity, assignment, loss-reason, and activity fields. It does not change ownership permissions, assignment history, lead creation dates, or database schema.
