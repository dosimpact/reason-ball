begin;

-- Unlisted conversations require the revocable share token. Direct JWT/anon
-- Data API reads may access only owned or public conversations (plus admins).
-- /api/share/[token] validates the token through its privileged server lookup.
create or replace function public.can_view_conversation(_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations
    where id = _conversation_id
      and status <> 'deleted'
      and (
        owner_id = (select auth.uid())
        or visibility = 'public'
      )
  ) or public.is_admin();
$$;

-- Evaluate candidate row fields to preserve INSERT ... RETURNING visibility.
alter policy conversations_select_visible on public.conversations
using (
  (
    status <> 'deleted'
    and (
      owner_id = (select auth.uid())
      or visibility = 'public'
    )
  )
  or public.is_admin()
);

commit;
