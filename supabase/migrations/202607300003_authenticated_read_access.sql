-- The CRM API reads under the signed-in user's JWT so that Row Level Security
-- can enforce role and workspace boundaries. The policies already existed, but
-- the authenticated role was missing its underlying SELECT grants.
grant select on table
  public.profiles,
  public.contacts,
  public.opportunities,
  public.assignments,
  public.activities,
  public.follow_ups,
  public.incorrect_reports,
  public.incorrect_reviews,
  public.opportunity_stage_history,
  public.opportunity_stage_ownership_periods
to authenticated;
