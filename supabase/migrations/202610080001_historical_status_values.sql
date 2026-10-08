-- Historical source states remain distinct from modern workflow outcomes.
alter type public.opportunity_status add value if not exists 'not_available';
alter type public.opportunity_status add value if not exists 'no_answer';
