begin;

-- Personal snapshots intentionally survive source conversation/message deletion.
-- Source IDs are provenance, not public links or authority to read a source.
create table public.learning_notebook_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  identity_key text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);
create unique index learning_notebook_identity on public.learning_notebook_entries(user_id, md5(identity_key));
create table public.learning_notebook_requests (
  user_id uuid not null,
  request_id uuid not null,
  draft jsonb not null,
  entry_id uuid not null,
  primary key(user_id, request_id),
  foreign key(user_id, entry_id) references public.learning_notebook_entries(user_id, id) on delete cascade
);
alter table public.learning_notebook_entries enable row level security;
alter table public.learning_notebook_requests enable row level security;
revoke all on public.learning_notebook_entries, public.learning_notebook_requests from public, anon, authenticated;
grant select on public.learning_notebook_entries to authenticated;
grant all on public.learning_notebook_entries, public.learning_notebook_requests to service_role;
create policy learning_notebook_read_self on public.learning_notebook_entries for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the trusted server computes the identity with the shared pure policy.
-- Browser roles cannot execute this owner-parameterized function.
create function public.save_learning_notebook(_owner_id uuid, _request_id uuid, _draft jsonb, _identity_key text)
returns table(entry jsonb, outcome text)
language plpgsql security definer set search_path = '' as $$
declare saved public.learning_notebook_entries%rowtype;
  previous public.learning_notebook_requests%rowtype;
  source_id uuid; message_ref text; result_kind text;
begin
  if _owner_id is null or _request_id is null or _draft is null or jsonb_typeof(_draft) <> 'object'
    or _identity_key is null or length(_identity_key) = 0 then
    raise exception using errcode='22023', message='invalid notebook input';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('notebook:' || _owner_id::text, 0));
  select * into previous from public.learning_notebook_requests r where r.user_id=_owner_id and r.request_id=_request_id;
  if found then
    if previous.draft <> _draft then raise exception using errcode='40001', message='notebook request changed'; end if;
    select * into saved from public.learning_notebook_entries e where e.user_id=_owner_id and e.id=previous.entry_id;
    result_kind := 'replayed';
  else
    source_id := (_draft->'source'->>'conversationId')::uuid;
    message_ref := _draft->'source'->>'messageId';
    perform 1 from public.conversations c where c.id=source_id and c.owner_id=_owner_id and c.status='active' for share;
    if not found then raise exception using errcode='P0002', message='owned active source not found'; end if;
    if message_ref is not null then
      perform 1 from public.messages m where m.conversation_id=source_id
        and (m.id::text=message_ref or m.client_message_id=message_ref) for share;
      if not found then raise exception using errcode='P0002', message='source message not found'; end if;
    end if;
    select * into saved from public.learning_notebook_entries e
      where e.user_id=_owner_id and md5(e.identity_key)=md5(_identity_key);
    if found then
      if saved.identity_key <> _identity_key then raise exception using errcode='40001', message='notebook identity conflict'; end if;
      result_kind := 'duplicate';
    else
      insert into public.learning_notebook_entries(user_id,id,draft,identity_key)
        values(_owner_id,_request_id,_draft,_identity_key) returning * into saved;
      result_kind := 'created';
    end if;
    insert into public.learning_notebook_requests(user_id,request_id,draft,entry_id)
      values(_owner_id,_request_id,_draft,saved.id);
  end if;
  return query select jsonb_build_object('id',saved.id,'draft',saved.draft,'createdAt',
    to_char(saved.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), result_kind;
end;
$$;
revoke execute on function public.save_learning_notebook(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_learning_notebook(uuid,uuid,jsonb,text) to service_role;

commit;
