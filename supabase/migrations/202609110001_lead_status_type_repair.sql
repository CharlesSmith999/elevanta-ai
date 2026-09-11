-- Repair the existing v1.7 routine without replacing unrelated deployed changes.
-- Preserve its signature, ownership, security settings, and grants. No lead data changes.
do $repair$
declare
  definition text;
  old_expression constant text := 'case when p_sales_owner_id is null then ''new'' else ''assigned'' end';
  new_expression constant text := 'case when p_sales_owner_id is null then ''new''::public.opportunity_status else ''assigned''::public.opportunity_status end';
begin
  select pg_get_functiondef('public.create_opportunity_v17(text,text,text,text,uuid,uuid,text,text)'::regprocedure)
    into definition;
  if strpos(definition, old_expression) > 0 then
    execute replace(definition, old_expression, new_expression);
  elsif strpos(definition, new_expression) = 0 then
    raise exception 'Unexpected create_opportunity_v17 definition; inspect before applying the status repair';
  end if;
end;
$repair$;
