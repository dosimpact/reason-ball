-- Server-only replay records. The request UUID is also the committed version UUID.
create table public.artifact_revision_requests (
  request_id uuid primary key references public.artifact_versions(id) on delete cascade,
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  expected_version_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index artifact_revision_requests_artifact_idx on public.artifact_revision_requests(artifact_id);
create index artifact_revision_requests_owner_idx on public.artifact_revision_requests(owner_id);
alter table public.artifact_revision_requests enable row level security;
revoke all on public.artifact_revision_requests from public, anon, authenticated;
grant all on public.artifact_revision_requests to service_role;

create or replace function public.commit_artifact_revision(
  _request_id uuid,
  _artifact_id uuid,
  _expected_owner_id uuid,
  _conversation_id uuid,
  _expected_version_id uuid,
  _payload jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  saved_request public.artifact_revision_requests%rowtype;
  locked_artifact public.artifacts%rowtype;
begin
  if _request_id is null or _artifact_id is null or _expected_owner_id is null
    or _conversation_id is null or _payload is null or jsonb_typeof(_payload) <> 'object'
  then
    raise exception using errcode = '22023', message = 'invalid artifact revision request';
  end if;

  -- Common lock order: conversation, then artifact. Also fences deletion.
  perform 1 from public.conversations as conversation
  where conversation.id = _conversation_id and conversation.owner_id = _expected_owner_id
    and conversation.status = 'active'
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'artifact conversation owner or state mismatch';
  end if;

  select * into locked_artifact from public.artifacts as artifact
  where artifact.id = _artifact_id for update;
  if found and (locked_artifact.owner_id is distinct from _expected_owner_id
    or locked_artifact.conversation_id is distinct from _conversation_id) then
    raise exception using errcode = '42501', message = 'artifact owner or conversation mismatch';
  end if;
  if locked_artifact.status = 'archived' then
    raise exception using errcode = '55000', message = 'archived artifact cannot be edited';
  end if;

  select * into saved_request from public.artifact_revision_requests as request
  where request.request_id = _request_id;
  if found then
    if saved_request.artifact_id is distinct from _artifact_id
      or saved_request.owner_id is distinct from _expected_owner_id
      or saved_request.expected_version_id is distinct from _expected_version_id
      or saved_request.payload is distinct from _payload
    then
      raise exception using errcode = '40001', message = 'artifact request key reused with different input';
    end if;
    return saved_request.request_id;
  end if;

  if _expected_version_id is null then
    if locked_artifact.id is not null then
      raise exception using errcode = '40001', message = 'artifact already exists';
    end if;
    perform * from public.create_artifact_with_version(
      _artifact_id, _request_id, _expected_owner_id, _conversation_id, _payload
    );
  else
    if locked_artifact.id is null then
      raise exception using errcode = 'P0002', message = 'artifact not found';
    end if;
    if locked_artifact.current_version_id is distinct from _expected_version_id then
      raise exception using errcode = '40001', message = 'artifact version changed';
    end if;
    -- Both operations share this transaction; an invalid version rolls back title too.
    if _payload ? 'title' then
      perform * from public.update_artifact_state(_artifact_id, _expected_owner_id, _payload ->> 'title', null);
    end if;
    perform * from public.append_artifact_version(_request_id, _artifact_id, _expected_owner_id, _payload);
  end if;

  insert into public.artifact_revision_requests(request_id, artifact_id, owner_id, expected_version_id, payload)
  values (_request_id, _artifact_id, _expected_owner_id, _expected_version_id, _payload);
  return _request_id;
end;
$$;
revoke execute on function public.commit_artifact_revision(uuid,uuid,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.commit_artifact_revision(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;
