begin;

-- Separate from the legacy chat-attachments bucket used by older Artifacts.
-- No anon/authenticated Storage policies: all access goes through owner checks.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('chat-message-files', 'chat-message-files', false, 2097152, array['image/png','image/jpeg','application/pdf'])
on conflict (id) do nothing;

create table public.chat_file_uploads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type in ('image/png','image/jpeg','application/pdf')),
  byte_size integer not null check (byte_size between 1 and 2097152),
  filename text not null check (char_length(filename) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chat_file_uploads_conversation_idx on public.chat_file_uploads(conversation_id);
alter table public.chat_file_uploads enable row level security;
revoke all on public.chat_file_uploads from public, anon, authenticated;
grant all on public.chat_file_uploads to service_role;

create function public.register_chat_file(_conversation_id uuid, _owner_id uuid, _sha256 text, _mime_type text, _byte_size integer, _filename text)
returns public.chat_file_uploads language plpgsql security definer set search_path = '' as $$
declare
  owned public.conversations%rowtype;
  stored public.chat_file_uploads%rowtype;
  object_path text;
begin
  select * into owned from public.conversations where id = _conversation_id for update;
  if not found or owned.owner_id is distinct from _owner_id then raise exception using errcode='42501', message='conversation owner mismatch'; end if;
  if owned.status <> 'active' then raise exception using errcode='55000', message='conversation not active'; end if;
  if _sha256 is null or _sha256 !~ '^[a-f0-9]{64}$' or _mime_type is null or _mime_type not in ('image/png','image/jpeg','application/pdf')
    or _byte_size is null or _byte_size not between 1 and 2097152 or char_length(coalesce(_filename,'')) not between 1 and 500 then
    raise exception using errcode='22023', message='invalid file metadata';
  end if;
  object_path := _owner_id::text || '/' || _conversation_id::text || '/' || _sha256 ||
    case _mime_type when 'image/png' then '.png' when 'image/jpeg' then '.jpg' else '.pdf' end;
  if not exists (select 1 from storage.objects where bucket_id='chat-message-files' and name=object_path) then
    raise exception using errcode='P0002', message='uploaded object missing';
  end if;
  insert into public.chat_file_uploads(conversation_id,owner_id,storage_path,sha256,mime_type,byte_size,filename)
  values (_conversation_id,_owner_id,object_path,_sha256,_mime_type,_byte_size,_filename)
  on conflict (storage_path) do nothing;
  select * into stored from public.chat_file_uploads where storage_path=object_path;
  if stored.byte_size <> _byte_size or stored.mime_type <> _mime_type then raise exception using errcode='40001', message='file metadata conflict'; end if;
  return stored;
end;
$$;
revoke execute on function public.register_chat_file(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.register_chat_file(uuid,uuid,text,text,integer,text) to service_role;

create function public.validate_chat_file_parts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare part jsonb; reference text; file_id uuid; file_count integer := 0;
begin
  if new.role <> 'user' then return new; end if;
  if tg_op='UPDATE' and new.parts is not distinct from old.parts and new.conversation_id=old.conversation_id
    and new.author_id is not distinct from old.author_id and new.role=old.role then return new; end if;
  for part in select value from jsonb_array_elements(new.parts) loop
    if part->>'type' <> 'file' then continue; end if;
    file_count := file_count + 1;
    reference := part->>'url';
    if file_count > 4 or reference is null or reference !~ '^chat-file://[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      or split_part(substring(reference from 13), '/', 1) <> new.conversation_id::text then
      raise exception using errcode='22023', message='invalid private file reference';
    end if;
    file_id := split_part(substring(reference from 13), '/', 2)::uuid;
    if not exists (select 1 from public.chat_file_uploads f where f.id=file_id and f.conversation_id=new.conversation_id
      and f.owner_id=new.author_id and f.mime_type=part->>'mediaType') then
      raise exception using errcode='42501', message='file reference owner or type mismatch';
    end if;
  end loop;
  return new;
end;
$$;
create trigger messages_private_file_refs before insert or update of parts,conversation_id,author_id,role on public.messages
for each row execute function public.validate_chat_file_parts();
revoke execute on function public.validate_chat_file_parts() from public,anon,authenticated;

commit;
