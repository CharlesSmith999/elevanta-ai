-- Fix confirmed v1.7 enum mismatches when adding a phone or email.
-- Preserve the deployed routine's role checks, signature, grants, and audit writes.
do $repair$
declare
  definition text;
  old_health constant text := 'case when v_restricted then ''do_not_contact'' else ''unverified'' end';
  new_health constant text := 'case when v_restricted then ''do_not_contact''::public.contact_method_health else ''unverified''::public.contact_method_health end';
  old_focus constant text := 'case when v_restricted then ''removed'' else ''active'' end';
  new_focus constant text := 'case when v_restricted then ''removed''::public.contact_method_focus else ''active''::public.contact_method_focus end';
begin
  select pg_get_functiondef('public.add_opportunity_contact_method(uuid,public.contact_method_type,text,text)'::regprocedure) into definition;
  if (strpos(definition,old_health)=0 and strpos(definition,new_health)=0)
    or (strpos(definition,old_focus)=0 and strpos(definition,new_focus)=0) then
    raise exception 'Unexpected contact-method function definition; inspect before repairing';
  end if;
  execute replace(replace(definition,old_health,new_health),old_focus,new_focus);
end;
$repair$;
