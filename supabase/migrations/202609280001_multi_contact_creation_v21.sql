-- One transaction: all contact methods and assignment succeed or nothing is created.
create or replace function public.create_opportunity_v21(
  p_name text, p_methods jsonb, p_source text default null,
  p_marketing_owner_id uuid default null, p_sales_owner_id uuid default null,
  p_description text default null, p_lead_category text default 'not_available'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_method jsonb; v_phone text; v_email text; v_key text;
  v_keys text[] := array[]::text[];
begin
  if public.current_role() not in ('admin','marketer') or public.current_workspace_id() is null then raise exception 'Not permitted'; end if;
  if p_methods is null or jsonb_typeof(p_methods) <> 'array' then raise exception 'Contact methods must be a list'; end if;
  if jsonb_array_length(p_methods) not between 1 and 20 then raise exception 'Provide between 1 and 20 contact methods'; end if;
  for v_method in select value from jsonb_array_elements(p_methods) loop
    if coalesce(v_method->>'type','') not in ('phone','email') or nullif(trim(v_method->>'value'),'') is null then raise exception 'Invalid contact method'; end if;
    if v_method->>'type' = 'phone' and (trim(v_method->>'value') !~ '^\+?[0-9() .-]+$' or length(regexp_replace(v_method->>'value','\D','','g')) not between 7 and 15) then raise exception 'Invalid phone number'; end if;
    if v_method->>'type' = 'email' and trim(v_method->>'value') !~ '^[^[:space:]@*]+@[^[:space:]@*]+\.[^[:space:]@*]+$' then raise exception 'Invalid email address'; end if;
    v_key := (v_method->>'type') || ':' || case when v_method->>'type' = 'phone' then regexp_replace(v_method->>'value','\D','','g') else lower(trim(v_method->>'value')) end;
    if v_key = any(v_keys) then raise exception 'Repeated contact method'; end if;
    v_keys := array_append(v_keys,v_key);
    if v_method->>'type' = 'phone' and v_phone is null then v_phone := trim(v_method->>'value'); end if;
    if v_method->>'type' = 'email' and v_email is null then v_email := trim(v_method->>'value'); end if;
  end loop;
  v_id := public.create_opportunity_v17(p_name,v_phone,v_email,p_source,p_marketing_owner_id,p_sales_owner_id,p_description,p_lead_category);
  for v_method in select value from jsonb_array_elements(p_methods) loop
    if (v_method->>'type' = 'phone' and trim(v_method->>'value') = v_phone) or (v_method->>'type' = 'email' and trim(v_method->>'value') = v_email) then continue; end if;
    perform public.add_opportunity_contact_method(v_id,(v_method->>'type')::public.contact_method_type,trim(v_method->>'value'));
  end loop;
  return v_id;
end;
$$;
revoke all on function public.create_opportunity_v21(text,jsonb,text,uuid,uuid,text,text) from public, anon;
grant execute on function public.create_opportunity_v21(text,jsonb,text,uuid,uuid,text,text) to authenticated;
