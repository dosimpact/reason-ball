-- INSERT ... RETURNING checks SELECT policies before a STABLE lookup can see
-- the inserted row. Evaluate visibility on the candidate row itself instead.
-- Preserve the existing owner/public/unlisted/deleted/admin access contract.
alter policy conversations_select_visible on public.conversations
using (
  (
    status <> 'deleted'
    and (
      owner_id = (select auth.uid())
      or visibility = 'public'
      or (visibility = 'unlisted' and (select auth.uid()) is not null)
    )
  )
  or public.is_admin()
);
