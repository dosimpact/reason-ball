begin;
set local lock_timeout = '5s';

alter table public.artifact_suggestions
  add column mode text check (mode in ('rewrite', 'grammar', 'analysis')),
  add column selection_start integer,
  add column selection_end integer,
  add constraint artifact_suggestions_selection_check check (
    (mode is null and selection_start is null and selection_end is null)
    or (mode is not null and mode in ('grammar', 'analysis') and selection_start is null and selection_end is null)
    or (mode is not null and mode = 'rewrite' and selection_start is not null and selection_end is not null
      and selection_start >= 0 and selection_end > selection_start)
  );
comment on column public.artifact_suggestions.mode is
  'Typed server-generated suggestion mode; NULL legacy rows have no recoverable provider metadata.';
comment on column public.artifact_suggestions.original_text is
  'For typed rows, the complete immutable source-version text snapshot; selection offsets use JavaScript UTF-16 units. Historical pending rows do not claim an application audit.';
create index artifact_suggestions_current_pending_idx
  on public.artifact_suggestions(artifact_version_id, owner_id, created_at desc, id desc)
  where status = 'pending' and mode is not null;

revoke all on public.artifact_suggestions from public, anon, authenticated;
grant select on public.artifact_suggestions to authenticated;
drop policy artifact_suggestions_insert_owned on public.artifact_suggestions;
drop policy artifact_suggestions_update_owned on public.artifact_suggestions;
drop policy artifact_suggestions_delete_owned on public.artifact_suggestions;
drop policy artifact_suggestions_select_owned on public.artifact_suggestions;
create policy artifact_suggestions_select_owned on public.artifact_suggestions
  for select to authenticated using (
    owner_id = (select auth.uid()) and exists (
      select 1 from public.artifact_versions version join public.artifacts artifact on artifact.id = version.artifact_id
      where version.id = artifact_version_id and artifact.owner_id = (select auth.uid())
    )
  );

create function public.persist_artifact_suggestion(
  _request_id uuid, _artifact_id uuid, _expected_owner_id uuid, _expected_version_id uuid,
  _mode text, _selection_start integer, _selection_end integer,
  _source_content text, _suggested_text text, _description text
)
returns setof public.artifact_suggestions
language plpgsql security definer set search_path = ''
as $$
declare
  owned_conversation_id uuid;
  artifact public.artifacts%rowtype;
  saved public.artifact_suggestions%rowtype;
  source text;
  source_units integer;
begin
  if _request_id is null or _artifact_id is null or _expected_owner_id is null or _expected_version_id is null
    or _mode is null or _mode not in ('rewrite', 'grammar', 'analysis')
    or _source_content is null or char_length(btrim(_source_content)) not between 1 and 20000
    or _suggested_text is null or char_length(btrim(_suggested_text)) not between 1 and 20000
    or _description is null or char_length(btrim(_description)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'invalid artifact suggestion';
  end if;
  -- Browser selection offsets count astral characters as two UTF-16 units.
  select coalesce(sum(case when ascii(piece) > 65535 then 2 else char_length(piece) end), 0)::integer
    into source_units from regexp_split_to_table(_source_content, '') as piece;
  if source_units > 20000
    or (_mode = 'rewrite' and (_selection_start is null or _selection_end is null
      or _selection_start < 0 or _selection_end <= _selection_start or _selection_end > source_units))
    or (_mode <> 'rewrite' and (_selection_start is not null or _selection_end is not null)) then
    raise exception using errcode = '22023', message = 'invalid suggestion selection';
  end if;

  select a.conversation_id into owned_conversation_id from public.artifacts a
    where a.id = _artifact_id and a.owner_id = _expected_owner_id;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion owner mismatch'; end if;
  -- Same lock order as commit_artifact_revision: conversation, then artifact.
  perform 1 from public.conversations c where c.id = owned_conversation_id and c.owner_id = _expected_owner_id and c.status = 'active' for update;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion conversation unavailable'; end if;
  select a.* into artifact from public.artifacts a where a.id = _artifact_id
    and a.owner_id = _expected_owner_id and a.conversation_id = owned_conversation_id for update;
  if not found then raise exception using errcode = '42501', message = 'artifact suggestion owner changed'; end if;
  if artifact.status = 'archived' then raise exception using errcode = 'PT409', message = 'artifact is archived'; end if;
  if (_mode = 'grammar' and artifact.kind <> 'text') or (_mode = 'analysis' and artifact.kind <> 'sheet')
    or (_mode = 'rewrite' and artifact.kind not in ('text', 'code', 'sheet')) then
    raise exception using errcode = '22023', message = 'suggestion mode does not match artifact kind';
  end if;

  select v.content_text into source from public.artifact_versions v where v.id = _expected_version_id and v.artifact_id = _artifact_id;
  if not found or source is distinct from _source_content then
    raise exception using errcode = 'PT409', message = 'artifact suggestion source changed';
  end if;

  select s.* into saved from public.artifact_suggestions s where s.id = _request_id;
  if found then
    if saved.owner_id is distinct from _expected_owner_id or saved.artifact_version_id is distinct from _expected_version_id
      or saved.mode is distinct from _mode or saved.selection_start is distinct from _selection_start
      or saved.selection_end is distinct from _selection_end or saved.original_text is distinct from _source_content then
      raise exception using errcode = 'PT409', message = 'suggestion request key reused with different input';
    end if;
    return next saved; return;
  end if;
  if artifact.current_version_id is distinct from _expected_version_id then
    raise exception using errcode = 'PT409', message = 'artifact version changed before suggestion persistence';
  end if;
  insert into public.artifact_suggestions(id,artifact_version_id,owner_id,original_text,suggested_text,description,mode,selection_start,selection_end)
    values(_request_id,_expected_version_id,_expected_owner_id,_source_content,_suggested_text,_description,_mode,_selection_start,_selection_end)
    on conflict(id) do nothing returning * into saved;
  if not found then
    -- A concurrent call for another artifact can collide on the global request ID.
    select s.* into saved from public.artifact_suggestions s where s.id = _request_id;
    if saved.owner_id is distinct from _expected_owner_id or saved.artifact_version_id is distinct from _expected_version_id
      or saved.mode is distinct from _mode or saved.selection_start is distinct from _selection_start
      or saved.selection_end is distinct from _selection_end or saved.original_text is distinct from _source_content then
      raise exception using errcode = 'PT409', message = 'suggestion request key reused with different input';
    end if;
  end if;
  return next saved;
end;
$$;
revoke all on function public.persist_artifact_suggestion(uuid,uuid,uuid,uuid,text,integer,integer,text,text,text) from public, anon, authenticated;
grant execute on function public.persist_artifact_suggestion(uuid,uuid,uuid,uuid,text,integer,integer,text,text,text) to service_role;
commit;
