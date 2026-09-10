-- Private, immutable image objects: existing browser storage policies do not
-- grant INSERT/UPDATE/DELETE or SELECT on this bucket. Owner-gated APIs use service_role.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('artifact-images', 'artifact-images', false, 10485760, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.create_artifact_with_version(
  _artifact_id uuid,
  _artifact_version_id uuid,
  _expected_owner_id uuid,
  _conversation_id uuid,
  _payload jsonb
)
returns table (
  artifact_id uuid,
  artifact_version_id uuid,
  version_number integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  desired_status text := coalesce(nullif(_payload ->> 'status', ''), 'draft');
  source_message uuid := nullif(_payload ->> 'sourceMessageId', '')::uuid;
  storage_bucket text := nullif(_payload ->> 'storageBucket', '');
  storage_path text := nullif(_payload ->> 'storagePath', '');
begin
  if _artifact_id is null or _artifact_version_id is null
    or _expected_owner_id is null or _conversation_id is null
    or _payload is null or jsonb_typeof(_payload) <> 'object'
    or _payload ->> 'kind' not in ('text', 'code', 'image', 'sheet')
    or char_length(coalesce(_payload ->> 'title', '')) not between 1 and 200
    or desired_status not in ('draft', 'published')
  then
    raise exception using errcode = '22023', message = 'invalid artifact create request';
  end if;
  if not exists (
    select 1 from public.conversations as conversation
    where conversation.id = _conversation_id
      and conversation.owner_id = _expected_owner_id
      and conversation.status <> 'deleted'
  ) then
    raise exception using errcode = '42501', message = 'artifact conversation owner mismatch';
  end if;
  if source_message is not null and not exists (
    select 1 from public.messages as message
    where message.id = source_message
      and message.conversation_id = _conversation_id
  ) then
    raise exception using errcode = '23514', message = 'artifact source message mismatch';
  end if;
  if _payload ->> 'kind' = 'image' and (
    (_payload -> 'contentJson') ? 'imageUrl'
    or (storage_bucket is not null and storage_bucket <> 'artifact-images')
  ) then
    raise exception using errcode = '23514', message = 'image artifacts require private immutable storage references';
  end if;
  if nullif(_payload ->> 'contentText', '') is null
    and _payload -> 'contentJson' is null
    and (storage_bucket is null or storage_path is null)
  then
    raise exception using errcode = '23514', message = 'artifact version content is required';
  end if;
  if storage_bucket is not null and (
    storage_bucket not in ('chat-attachments', 'artifact-images')
    or split_part(storage_path, '/', 1) <> _expected_owner_id::text
    or (storage_bucket = 'artifact-images' and (split_part(storage_path, '/', 2) <> _artifact_id::text or _payload ->> 'kind' <> 'image'))
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = storage_bucket and object.name = storage_path
    )
  ) then
    raise exception using errcode = '23514', message = 'invalid artifact storage object';
  end if;

  insert into public.artifacts (
    id, conversation_id, owner_id, kind, title, status
  ) values (
    _artifact_id, _conversation_id, _expected_owner_id,
    _payload ->> 'kind', _payload ->> 'title', 'draft'
  );

  insert into public.artifact_versions (
    id, artifact_id, version_number, source_message_id,
    content_text, content_json, storage_bucket, storage_path, created_by
  ) values (
    _artifact_version_id, _artifact_id, 1, source_message,
    nullif(_payload ->> 'contentText', ''), _payload -> 'contentJson',
    storage_bucket, storage_path, _expected_owner_id
  );

  update public.artifacts as artifact
  set current_version_id = _artifact_version_id, status = desired_status
  where artifact.id = _artifact_id;

  if desired_status = 'published' then
    update public.artifact_versions as version
    set published_at = timezone('utc', now())
    where version.id = _artifact_version_id;
  end if;

  return query select _artifact_id, _artifact_version_id, 1, desired_status;
end;
$$;

create or replace function public.append_artifact_version(
  _artifact_version_id uuid,
  _artifact_id uuid,
  _expected_owner_id uuid,
  _payload jsonb
)
returns table (
  artifact_id uuid,
  artifact_version_id uuid,
  version_number integer,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_artifact public.artifacts%rowtype;
  next_version integer;
  desired_status text := coalesce(nullif(_payload ->> 'status', ''), 'draft');
  source_message uuid := nullif(_payload ->> 'sourceMessageId', '')::uuid;
  storage_bucket text := nullif(_payload ->> 'storageBucket', '');
  storage_path text := nullif(_payload ->> 'storagePath', '');
begin
  if _artifact_version_id is null or _artifact_id is null
    or _expected_owner_id is null or _payload is null
    or jsonb_typeof(_payload) <> 'object'
    or desired_status not in ('draft', 'published')
  then
    raise exception using errcode = '22023', message = 'invalid artifact version request';
  end if;

  select * into locked_artifact
  from public.artifacts as artifact
  where artifact.id = _artifact_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'artifact not found';
  end if;
  if locked_artifact.owner_id is distinct from _expected_owner_id then
    raise exception using errcode = '42501', message = 'artifact owner mismatch';
  end if;
  if locked_artifact.kind = 'image' and (
    (_payload -> 'contentJson') ? 'imageUrl'
    or (storage_bucket is not null and storage_bucket <> 'artifact-images')
  ) then
    raise exception using errcode = '23514', message = 'image artifacts require private immutable storage references';
  end if;
  if source_message is not null and not exists (
    select 1 from public.messages as message
    where message.id = source_message
      and message.conversation_id = locked_artifact.conversation_id
  ) then
    raise exception using errcode = '23514', message = 'artifact source message mismatch';
  end if;
  if nullif(_payload ->> 'contentText', '') is null
    and _payload -> 'contentJson' is null
    and (storage_bucket is null or storage_path is null)
  then
    raise exception using errcode = '23514', message = 'artifact version content is required';
  end if;
  if storage_bucket is not null and (
    storage_bucket not in ('chat-attachments', 'artifact-images')
    or split_part(storage_path, '/', 1) <> _expected_owner_id::text
    or (storage_bucket = 'artifact-images' and (split_part(storage_path, '/', 2) <> locked_artifact.id::text or locked_artifact.kind <> 'image'))
    or not exists (
      select 1 from storage.objects as object
      where object.bucket_id = storage_bucket and object.name = storage_path
    )
  ) then
    raise exception using errcode = '23514', message = 'invalid artifact storage object';
  end if;

  select coalesce(max(version.version_number), 0) + 1 into next_version
  from public.artifact_versions as version
  where version.artifact_id = locked_artifact.id;

  insert into public.artifact_versions (
    id, artifact_id, version_number, source_message_id,
    content_text, content_json, storage_bucket, storage_path, created_by
  ) values (
    _artifact_version_id, locked_artifact.id, next_version, source_message,
    nullif(_payload ->> 'contentText', ''), _payload -> 'contentJson',
    storage_bucket, storage_path, _expected_owner_id
  );

  update public.artifacts as artifact
  set current_version_id = _artifact_version_id, status = desired_status
  where artifact.id = locked_artifact.id;

  if desired_status = 'published' then
    update public.artifact_versions as version
    set published_at = timezone('utc', now())
    where version.id = _artifact_version_id;
  end if;

  return query select locked_artifact.id, _artifact_version_id, next_version, desired_status;
end;
$$;
