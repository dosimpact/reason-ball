-- Activity is an approximate presence metric, never a reward/XP authority.
alter table public.daily_learning_stats
  add column active_seconds bigint not null default 0 check (active_seconds >= 0);
update public.daily_learning_stats set active_seconds = active_minutes::bigint * 60;
alter table public.daily_learning_stats add constraint learning_minutes_match_seconds
  check (active_minutes = active_seconds / 60);

create table public.learning_activity_clocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz,
  active boolean not null default false
);
create table public.learning_activity_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  conversation_id uuid not null,
  active boolean not null,
  accepted_seconds integer not null check (accepted_seconds between 0 and 45),
  recorded_at timestamptz not null,
  primary key (user_id, request_id)
);
alter table public.learning_activity_clocks enable row level security;
alter table public.learning_activity_receipts enable row level security;
revoke all on public.learning_activity_clocks, public.learning_activity_receipts from public, anon, authenticated;
grant all on public.learning_activity_clocks, public.learning_activity_receipts to service_role;

-- Pure interval policy. Round endpoints, not each duration, so consecutive
-- sub-second remainders are not lost. At most two UTC dates are produced.
create function public.learning_activity_slices(_from timestamptz, _to timestamptz)
returns table(learning_date date, seconds integer)
language sql immutable set search_path = '' as $$
  with bounds as (
    select date_trunc('second', _from) as a, date_trunc('second', _to) as b
    where _to > _from and _to - _from <= interval '45 seconds'
  ), dates as (
    select a, b, generate_series(
      (a at time zone 'utc')::date::timestamp,
      (b at time zone 'utc')::date::timestamp, interval '1 day'
    ) at time zone 'utc' as start_at from bounds
  )
  select (start_at at time zone 'utc')::date,
    extract(epoch from least(b, start_at + interval '24 hours') - greatest(a, start_at))::integer
  from dates where least(b, start_at + interval '24 hours') > greatest(a, start_at)
$$;
revoke all on function public.learning_activity_slices(timestamptz,timestamptz) from public, anon, authenticated;

create function public.record_learning_activity(_conversation_id uuid, _request_id uuid, _active boolean)
returns table(accepted_seconds integer, recorded_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.learning_activity_clocks%rowtype;
  receipt public.learning_activity_receipts%rowtype;
  observed_at timestamptz;
  accepted integer := 0;
  slice record;
begin
  if actor is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  if _conversation_id is null or _request_id is null or _active is null then
    raise exception using errcode = '22023', message = 'activity fields required';
  end if;
  perform 1 from public.conversations c where c.id = _conversation_id and c.owner_id = actor and c.status = 'active' for share;
  if not found then raise exception using errcode = '42501', message = 'active owned conversation required'; end if;
  insert into public.learning_activity_clocks(user_id) values(actor) on conflict do nothing;
  select * into previous from public.learning_activity_clocks c where c.user_id = actor for update;
  select * into receipt from public.learning_activity_receipts r where r.user_id = actor and r.request_id = _request_id;
  if found then
    if receipt.conversation_id <> _conversation_id or receipt.active <> _active then
      raise exception using errcode = '22023', message = 'activity request key reused with different input';
    end if;
    return query select receipt.accepted_seconds, receipt.recorded_at;
    return;
  end if;
  observed_at := clock_timestamp();
  if previous.active and previous.last_seen_at is not null then
    for slice in select * from public.learning_activity_slices(previous.last_seen_at, observed_at) loop
      insert into public.daily_learning_stats as daily(user_id, learning_date, active_seconds, active_minutes)
        values(actor, slice.learning_date, slice.seconds, slice.seconds / 60)
      on conflict(user_id, learning_date) do update set
        active_seconds = daily.active_seconds + excluded.active_seconds,
        active_minutes = ((daily.active_seconds + excluded.active_seconds) / 60)::integer;
      accepted := accepted + slice.seconds;
    end loop;
  end if;
  update public.learning_activity_clocks c set last_seen_at = observed_at, active = _active where c.user_id = actor;
  insert into public.learning_activity_receipts(user_id, request_id, conversation_id, active, accepted_seconds, recorded_at)
    values(actor, _request_id, _conversation_id, _active, accepted, observed_at);
  return query select accepted, observed_at;
end
$$;
revoke all on function public.record_learning_activity(uuid,uuid,boolean) from public, anon;
grant execute on function public.record_learning_activity(uuid,uuid,boolean) to authenticated;

-- Count committed learner message inserts, not streamed assistant updates or
-- repeated upserts. Deleting history does not erase past daily activity.
create function public.record_learner_message_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid;
begin
  if new.role <> 'user' then return new; end if;
  select c.owner_id into actor from public.conversations c where c.id = new.conversation_id;
  if actor is distinct from new.author_id then return new; end if;
  insert into public.daily_learning_stats as daily(user_id, learning_date, messages_sent)
    values(actor, (clock_timestamp() at time zone 'utc')::date, 1)
  on conflict(user_id, learning_date) do update set messages_sent = daily.messages_sent + 1;
  return new;
end
$$;
revoke all on function public.record_learner_message_activity() from public, anon, authenticated;
create trigger messages_record_learning_activity after insert on public.messages
  for each row execute function public.record_learner_message_activity();
