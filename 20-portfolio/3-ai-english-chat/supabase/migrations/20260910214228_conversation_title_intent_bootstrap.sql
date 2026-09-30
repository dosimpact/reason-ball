begin;
set local lock_timeout = '5s';

-- Opting one's new conversation into automatic naming is a public creation
-- choice. Keep INSERT under the caller's RLS instead of granting marker writes.
create function app_private.bootstrap_conversation_title_intent()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.title_source = 'manual' and new.metadata->>'initialTitleMode' = 'auto' then
    new.title_source := 'pending';
  end if;
  return new;
end;
$$;
revoke all on function app_private.bootstrap_conversation_title_intent() from public, anon, authenticated, service_role;
create trigger conversations_bootstrap_title_intent before insert on public.conversations
  for each row execute function app_private.bootstrap_conversation_title_intent();

comment on function app_private.bootstrap_conversation_title_intent() is
  'Reads public initialTitleMode only at creation, preserving caller RLS. Later metadata writes never reset auto/manual intent; explicit trusted pending is preserved.';
commit;
