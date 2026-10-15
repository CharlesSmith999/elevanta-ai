# CRM startup database reliability, v1.22

Approved by the owner on October 15, 2026.

- The signed-in CRM must load the complete set of leads visible to the current role without exceeding the database statement timeout.
- Opportunity records and their one-to-many history are read in bounded pages and combined by opportunity ID in the API.
- Assignments, activities, follow-ups, incorrect reports, and Admin review records remain available. No record is merged, removed, or relabeled by this change.
- Existing row-level security remains the authority for role visibility. The API does not use an elevated database client for this read.
- Lead ordering, current ownership, assignment history, dashboards, and lead-detail history keep their approved behavior.
- Loss reasons returned by the database are retained in the web lead model.

This is a read-performance correction. It does not change the database schema, imported lead data, user roles, permissions, workflow, or approved business definitions.
