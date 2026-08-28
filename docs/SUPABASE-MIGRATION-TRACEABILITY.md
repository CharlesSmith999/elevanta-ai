# Supabase Migration Traceability

Status: Reconciled through v1.7 on 2026-08-28

Project: `jayxyikgefnzitxcbdov`

## Result

The production Supabase project has a canonical `supabase_migrations.schema_migrations` ledger containing all 14 migrations released through lead details and reporting v1.7.

Before the ledger was created, each migration was checked against the live schema. That verification found one material mismatch: migration `202607290005_dashboard_completion_events.sql` had not completed because its loss-reason validation contained an invalid one-argument `nullif` call. The source SQL was corrected, the migration was applied, and all 10 migration-effect checks passed before any version was recorded.

No lead records were imported, removed, or activated during this reconciliation.

## Recorded versions

| Version | Name |
|---|---|
| `202607280001` | `foundation` |
| `202607280002` | `crm_core_controls` |
| `202607290003` | `dashboard_data_definitions` |
| `202607290004` | `opportunity_stage_history` |
| `202607290005` | `dashboard_completion_events` |
| `202607290006` | `reconcile_missing_controls` |
| `202607300001` | `milestone2_core` |
| `202607300002` | `admin_user_management` |
| `202607300003` | `authenticated_read_access` |
| `202608170001` | `xaviar_milestone4` |
| `202608230001` | `lead_workflow_v16` |
| `202608230002` | `xaviar_lead_workflow_v11` |
| `202608230003` | `status_guard_v16` |
| `202608250001` | `lead_details_reporting_v17` |

## 2026-08-23 lead workflow verification

The three v1.6 migrations were applied in filename order using the approved Supabase workflow. The release verification confirmed the four new workflow tables, guarded contact-method and activity routines, the automatic contact-method trigger for newly created opportunities, four RLS policies, and all three migration-ledger entries. No real lead data was imported or changed.

## 2026-08-25 v1.7 verification

`202608250001_lead_details_reporting_v17.sql` is applied and recorded in the canonical migration ledger. Verification confirmed the controlled lead-category column, reporter-role evidence, scoped create/edit routines, type-safe contact-method entry, whole-lead reporting, and the rule that only three distinct Sales Agent reports trigger Admin review. No real lead records were imported, removed, or activated.

## Required process for future migrations

1. Add one timestamped SQL file under `supabase/migrations/`.
2. Review the SQL for additive and rollback-safe behaviour.
3. Apply it through the approved Supabase migration workflow. Do not make an untracked dashboard-only schema change.
4. Confirm the version appears in `supabase_migrations.schema_migrations`.
5. Verify the intended tables, columns, functions, triggers, policies, and grants.
6. Run the application test suite and production smoke checks before closing the release.

If the live schema and migration ledger ever differ, verify the schema effects first. Never mark a migration applied only to silence a tooling warning.
