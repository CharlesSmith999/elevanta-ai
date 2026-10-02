# Admin user management

This feature is part of the Phase 1 CRM foundation and follows the approved role model in `CRM-PLAN.md`.

## Repair scope, October 2, 2026

Live inspection found legacy accounts with unset departments. The creation form offers these managers even though the API rejects them. It also labels every manager as Sales Manager and hides validation errors outside the dialog.

The repair keeps the approved hierarchy and inactive-account policy. Offer five explicit role choices, derive the department, require an eligible same-department manager only for agents, show actionable errors in the form, and prevent duplicate submissions. Managers with missing departments must be explicitly configured by Admin, never assigned a department by guessing their name. Permit repairing a missing manager department when existing reports belong to that department.

Admin can edit profiles and set Active/Inactive, then reactivate when appropriate. Do not permanently delete users. Preserve history, block deactivation with active assignments or direct reports, and prevent removing the last Admin through either deactivation or role changes. Existing-role setup defects must not block a name-only edit or safe deactivation.

Validation: creation for all five roles; missing/wrong/inactive manager; role/department mismatch; duplicate email; cross-workspace and non-Admin denial; editing; self/last-Admin protection; direct-report and assignment blockers; inactive API denial. Production account creation or role changes for real people are not part of diagnostic testing.

## What Admin can do

- View all profiles in the current workspace, including account email, role, department, manager, active status, and last sign-in.
- Create a user with a verified email, temporary password, full name, role, department, and manager.
- Edit a user’s name, role, department, manager, and active access.
- Deactivate a user without deleting their authentication identity or historical activity.

The UI is only a convenience. The Node API enforces the same rules for every request.

## Rules enforced by the API

- Only an authenticated Admin in the same workspace can use these endpoints.
- Admins have no department and no manager.
- Every agent/marketer must have an active manager in the same department; department managers do not need a manager.
- A user cannot manage themselves.
- An Admin cannot deactivate their own account.
- The last active Admin cannot be deactivated.
- A manager with active direct reports cannot be deactivated until those reports are reassigned.
- A manager with active direct reports cannot be changed to another department or role until those reports are reassigned.
- A user with active lead assignments cannot be deactivated until those leads are reassigned.
- Creating a profile is transactional in practice: if the profile insert fails, the newly created Auth user is removed.
- Email addresses are normalized to lowercase by validation; passwords are sent only to Supabase Auth and are never returned or written to a profile or audit record.
- Profile create/edit operations write an immutable `audit_events` record. Deactivation preserves all historical leads and activities.

## API

- `GET /api/v1/admin/users`
- `POST /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id`

The API requires `SUPABASE_SERVICE_ROLE_KEY` in the Node/Vercel API environment. This is a server-only secret and must never be exposed as a `VITE_` variable, committed to Git, or placed in browser code.

## Department mapping

- `marketing`: marketers and the Marketing manager.
- `sales`: sales agents and the Sales manager.
- `admin`: no department.

The migration adds the nullable `profiles.department` field and an index for active role/team lookups. Existing profiles remain valid and can be completed by an Admin during the first user-management review.
