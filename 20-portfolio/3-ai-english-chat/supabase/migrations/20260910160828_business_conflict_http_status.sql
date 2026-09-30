begin;

-- Application revision/idempotency conflicts are permanent for the submitted
-- input. SQLSTATE 40001 tells PostgREST 14 to retry the transaction indefinitely.
-- PT409 returns HTTP 409 immediately while preserving genuine database-generated
-- serialization failures and every RPC's data, locking, privilege and grant rules.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

do $migration$
declare
  target record;
  before_function record;
  after_function record;
  definition text;
  occurrences integer;
begin
  for target in select * from (values
    ('public.create_character_version(uuid,uuid,uuid,integer,jsonb)', 1),
    ('public.create_mission_version(uuid,uuid,uuid,integer,jsonb)', 1),
    ('public.begin_chat_generation(uuid,uuid,text,jsonb,uuid,text)', 1),
    ('public.begin_chat_generation_user(uuid,uuid,text,jsonb,uuid,text)', 3),
    ('public.finish_chat_generation_base(uuid,uuid,uuid,uuid,text,jsonb,text)', 2),
    ('public.commit_artifact_revision(uuid,uuid,uuid,uuid,uuid,jsonb)', 3),
    ('public.replace_message_branch(uuid,uuid,uuid,uuid,uuid,jsonb)', 3),
    ('public.prepare_response_regeneration(uuid,uuid,uuid,uuid)', 3),
    ('public.register_chat_file(uuid,uuid,text,text,integer,text)', 1),
    ('public.start_mission_run(uuid,uuid,uuid,uuid,uuid,uuid,text)', 1),
    ('public.complete_mission_run_unchecked(uuid,uuid,uuid,uuid)', 1),
    ('public.begin_chat_tool_continuation(uuid,uuid,uuid,uuid,text,jsonb)', 6),
    ('public.save_learning_preferences(integer,jsonb)', 1),
    ('public.save_learning_notebook(uuid,uuid,jsonb,text)', 2),
    ('public.set_saved_mission(uuid,uuid,boolean)', 1)
  ) as reviewed(signature, expected_occurrences)
  loop
    select oid, prosrc, proowner, prosecdef, proconfig, proacl
      into strict before_function from pg_proc
      where oid = to_regprocedure(target.signature);
    select count(*) into occurrences
      from regexp_matches(before_function.prosrc, 'errcode\s*=\s*''40001''', 'g');
    if occurrences <> target.expected_occurrences then
      raise exception 'Unexpected application conflict definitions in %: expected %, found %',
        target.signature, target.expected_occurrences, occurrences;
    end if;
    definition := pg_get_functiondef(before_function.oid);
    -- Reject any unreviewed use of this literal (e.g. catches or string data).
    if (length(definition) - length(replace(definition, '''40001''', ''))) / length('''40001''') <> occurrences then
      raise exception 'Unreviewed SQLSTATE literal in %', target.signature;
    end if;
    execute replace(definition, '''40001''', '''PT409''');
    select oid, proowner, prosecdef, proconfig, proacl into strict after_function
      from pg_proc where oid = to_regprocedure(target.signature);
    if after_function.oid <> before_function.oid
      or after_function.proowner <> before_function.proowner
      or after_function.prosecdef <> before_function.prosecdef
      or after_function.proconfig is distinct from before_function.proconfig
      or after_function.proacl is distinct from before_function.proacl then
      raise exception 'RPC identity or privileges changed unexpectedly for %', target.signature;
    end if;
  end loop;
end;
$migration$;

commit;
