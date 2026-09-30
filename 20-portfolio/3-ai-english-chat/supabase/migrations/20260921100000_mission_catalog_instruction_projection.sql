begin;

-- Project only catalog adapter fields before crossing the Data API boundary.
-- jsonb_each preserves the distinction between a missing key and JSON null.
create view public.mission_catalog_instruction_fields
with (security_invoker=true)
as select instructions.mission_version_id,
  coalesce((
    select jsonb_object_agg(field.key,field.value)
    from jsonb_each(instructions.evaluator_config) as field
    where field.key in ('prerequisites','objectives','catalogDisplay')
  ),'{}'::jsonb) as evaluator_config
from public.mission_version_instructions instructions;

revoke all on public.mission_catalog_instruction_fields from public,anon,authenticated,service_role;
grant select on public.mission_catalog_instruction_fields to service_role;
comment on view public.mission_catalog_instruction_fields is
  'Server-only catalog projection. Preserves missing/null validation while excluding director/evaluator prompts and catalogImport.source at the database boundary.';

commit;
