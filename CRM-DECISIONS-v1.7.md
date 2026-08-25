# Elevanta AI — Lead Details and Incorrect Reporting Decisions v1.7

Status: Approved by product owner on 2026-08-25

This version extends [CRM-DECISIONS-v1.6.md](./CRM-DECISIONS-v1.6.md). It governs lead details, lead editing, contact-method entry, lead categories, and incorrect-lead reporting. All non-conflicting v1.6 rules remain valid.

| Decision | Approved rule |
|---|---|
| Lead description | Lead creation and lead editing include a description field. Description is optional, limited, auditable, and displayed in the Lead Workspace. |
| Lead category | Lead creation and editing use one controlled category: `App`, `Game`, `SEO`, `SMM`, `Web`, or `Not available`. These values come from the approved workbook. Historical and uncategorized records default to `Not available`. |
| Lead detail editing | Admin, Marketing Manager within marketing scope, and the Marketing Agent who owns the lead may edit lead name, source, category, and description. Sales Agents and Sales Managers cannot edit these Marketing-owned details. |
| Contact entry | The Add Contact dialog supports both phone and email. It changes validation, keyboard/input behavior, and labels based on the selected method. A valid phone or email is required, duplicate methods are rejected, and successful additions are audited. |
| Method health versus lead state | Marking one phone number or email `Incorrect` never marks the complete lead incorrect. Contact-method health and opportunity-level incorrect reporting remain separate actions. |
| Complete-lead flag | Any authorized user who can see the lead may submit one explicit incorrect-lead flag with a reason and optional evidence. The flag does not close the lead by itself. |
| Three-Sales threshold | Only reports from three distinct Sales Agents count toward the automatic Admin Incorrect Review threshold. Marketing, Manager, and Admin flags remain visible evidence but do not increase this counter. |
| Admin decision | When three distinct Sales reports exist, routing pauses and exactly one Admin review item is created. Only the Admin decision may confirm the complete lead as Incorrect, reject the reports, or merge it as Duplicate. |
| Xaviar boundary | Xaviar may analyze method-health changes, all role flags, the Sales-only threshold count, and Admin outcomes. It remains advisory and cannot flag, close, restore, or change a lead. |

## Required user-interface behavior

1. Create Lead includes Description and Lead Category.
2. Eligible Marketing-side users receive an Edit Lead action in the Lead Workspace.
3. Add Contact clearly switches between Phone number and Email address modes.
4. The workspace explains that removing a method does not mark the full lead incorrect.
5. An explicit Flag Lead action is available to authorized viewers, with the Sales threshold shown separately.

## Implementation reference

The implementation contract remains [LEAD-WORKFLOW-SPEC-v1.0.md](./LEAD-WORKFLOW-SPEC-v1.0.md), updated for this decision. Real lead-data migration remains Milestone 5 only.
