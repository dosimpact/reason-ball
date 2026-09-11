begin;

-- Bound the deployment's wait; if busy, retry the whole migration later.
set local lock_timeout = '5s';
lock table public.conversations, public.characters in share row exclusive mode;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated, service_role;

create function app_private.maintain_character_conversation_count()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  old_character uuid;
  new_character uuid;
begin
  if tg_op <> 'INSERT' then
    if old.status <> 'deleted' then old_character := old.character_id; end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.status <> 'deleted' then new_character := new.character_id; end if;
  end if;
  -- Includes active <-> archived and updates of unrelated fields.
  if old_character is not distinct from new_character then return null; end if;

  -- Atomic deltas avoid recount races. UUID ordering handles opposite transfers;
  -- NO KEY UPDATE remains compatible with the conversation FK's KEY SHARE lock.
  perform id from public.characters
    where id in (old_character, new_character)
    order by id for no key update;
  if old_character is not null then
    update public.characters set conversation_count = conversation_count - 1
      where id = old_character;
  end if;
  if new_character is not null then
    update public.characters set conversation_count = conversation_count + 1
      where id = new_character;
  end if;
  return null;
end;
$$;
revoke all on function app_private.maintain_character_conversation_count() from public, anon, authenticated, service_role;

create trigger conversations_maintain_character_count
  after insert or delete or update of character_id, status on public.conversations
  for each row execute function app_private.maintain_character_conversation_count();

-- Both source and target writes are blocked until the initial snapshot and
-- trigger installation commit together. Include archived, exclude soft-deleted.
update public.characters as character
set conversation_count = (select count(*) from public.conversations as conversation
  where conversation.character_id = character.id and conversation.status <> 'deleted');

comment on column public.characters.conversation_count is
  'Number of saved conversations in active or archived state; excludes deleted conversations, not a distinct learner count. Maintained by an internal trigger.';

commit;
