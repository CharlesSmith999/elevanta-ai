begin;

alter table public.agent_email_context_suggestions
  add column if not exists suggested_status text,
  add column if not exists suggested_qualification text;

alter table public.agent_email_context_suggestions
  add constraint agent_email_context_suggestions_status_check
    check (suggested_status is null or suggested_status in ('contacted','connected','follow_up_required','qualified','proposal_sent','won','lost','not_interested','do_not_contact'));

alter table public.agent_email_context_suggestions
  add constraint agent_email_context_suggestions_qualification_check
    check (suggested_qualification is null or suggested_qualification in ('mql','sql','not_available'));

commit;
