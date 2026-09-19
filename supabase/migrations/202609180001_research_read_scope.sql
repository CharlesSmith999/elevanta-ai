begin;
-- Recheck active membership on direct database reads as well as API requests.
alter policy "inbound candidates marketing scope" on public.inbound_lead_candidates
using (
  workspace_id=public.current_workspace_id()
  and exists(select 1 from public.profiles viewer where viewer.id=auth.uid() and viewer.active)
  and (
    public.current_role()='admin'
    or (public.current_role()='marketer' and marketing_owner_id=auth.uid())
    or exists (
      select 1 from public.profiles owner join public.profiles viewer on viewer.id=auth.uid()
      where owner.id=marketing_owner_id and owner.manager_id=viewer.id
        and viewer.role='manager' and viewer.department='marketing'
    )
  )
);
commit;
