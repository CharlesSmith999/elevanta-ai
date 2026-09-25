# CRM Decisions v1.14 — Research Handoff Context and Agent Workflow UX

Status: Approved by product owner on 2026-09-25

This decision extends the active lead-workflow contract. It does not change the deferred real-data migration or Gmail read-only permissions.

## Approved handoff context

When Marketing publishes a Research Lead to a selected Sales Agent, the normal CRM lead must retain and show Sales-useful context:

- all discovered valid phone numbers and email addresses;
- source, category, address, description, original request details, and source received time;
- the Marketing research summary; and
- Marketing owner and active Sales assignment.

Evidence links, original masked source contacts, Gmail/provider identifiers, credits, parser state, duplicate-review detail, and the full Research record remain restricted to Marketing, Marketing Managers, and Admin. Sales cannot access the Research Queue or infer its contents outside the approved handoff context.

## Usability decisions

- Phone and email entry must be separately visible in the Research workspace. Email is not hidden behind a default phone selector.
- Research and Lead Inbox pages provide search and filters appropriate to their visible scope.
- The normal lead creation form separates lead/project information, contact information, and optional Sales assignment.
- Handoff makes the selected Sales Agent and the information that will transfer clear before submission.
- The notification bell is compact by default and opens settings only on demand. Volume can be reduced but not muted.

## Verification requirement

Every Research handoff must create one normal opportunity with one active Sales assignment. The assigned Sales Agent can read that opportunity and its allowed handoff context; another Sales Agent cannot.
