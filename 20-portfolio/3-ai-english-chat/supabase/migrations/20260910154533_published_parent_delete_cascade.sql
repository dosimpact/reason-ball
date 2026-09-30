begin;

-- Permit privileged FK cleanup only after its parent was actually deleted.
-- Direct published mutations and snapshots protected by FK RESTRICT remain blocked.
create or replace function public.prevent_published_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_table_name = 'character_versions' then
      if not exists (select 1 from public.characters where id = old.character_id) then return old; end if;
    elsif tg_table_name = 'mission_versions' then
      if not exists (select 1 from public.missions where id = old.mission_id) then return old; end if;
    end if;
  end if;
  if current_user in ('postgres', 'supabase_admin')
    and current_setting('app.immutable_purge', true) = 'enabled'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if old.published_at is not null then
    raise exception using
      errcode = '55000',
      message = 'published versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_published_character_instruction_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.character_versions v join public.characters c on c.id = v.character_id where v.id = old.character_version_id)
  then return old; end if;
  target_version_id := case
    when tg_op = 'DELETE' then old.character_version_id
    else new.character_version_id
  end;

  if exists (
    select 1
    from public.character_versions as version
    where version.id = target_version_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published character instructions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_published_mission_child_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.mission_versions v join public.missions m on m.id = v.mission_id where v.id = old.mission_version_id)
  then return old; end if;
  if tg_table_name = 'mission_version_instructions' then
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  elsif tg_table_name = 'mission_steps' then
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  else
    target_version_id := case
      when tg_op = 'DELETE' then old.mission_version_id
      else new.mission_version_id
    end;
  end if;

  if exists (
    select 1
    from public.mission_versions as version
    where version.id = target_version_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published mission version children are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_published_mission_character_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_mission_id uuid;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role')
    and not exists (select 1 from public.missions where id = old.mission_id)
  then return old; end if;
  target_mission_id := case
    when tg_op = 'DELETE' then old.mission_id
    else new.mission_id
  end;

  if exists (
    select 1
    from public.mission_versions as version
    where version.mission_id = target_mission_id
      and version.published_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'published mission character assignments are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_published_asset_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_version_id uuid;
  new_version_id uuid;
  target_asset_id uuid;
  target_asset_type text;
begin

  if tg_op = 'DELETE' and pg_trigger_depth() > 1
    and current_user in ('postgres', 'supabase_admin', 'service_role') then
    if tg_table_name = 'character_assets' then
      -- Reward assets still honor surviving published mission references below.
      if old.asset_type <> 'reward' and not exists (select 1 from public.characters where id = old.character_id) then return old; end if;
    elsif tg_table_name = 'mission_assets' then
      if not exists (select 1 from public.missions where id = old.mission_id) then return old; end if;
    end if;
  end if;
  old_version_id := case when tg_op = 'INSERT' then null else
    nullif(coalesce(
      to_jsonb(old) ->> 'character_version_id',
      to_jsonb(old) ->> 'mission_version_id'
    ), '')::uuid end;
  new_version_id := case when tg_op = 'DELETE' then null else
    nullif(coalesce(
      to_jsonb(new) ->> 'character_version_id',
      to_jsonb(new) ->> 'mission_version_id'
    ), '')::uuid end;

  if tg_table_name = 'character_assets' then
    target_asset_id := nullif(
      case when tg_op = 'INSERT' then to_jsonb(new) ->> 'id'
        else to_jsonb(old) ->> 'id' end,
      ''
    )::uuid;
    target_asset_type := case when tg_op = 'DELETE'
      then to_jsonb(old) ->> 'asset_type'
      else to_jsonb(new) ->> 'asset_type' end;

    if target_asset_type <> 'reward' and exists (
      select 1 from public.character_versions as version
      where version.id in (old_version_id, new_version_id)
        and version.published_at is not null
    ) then
      raise exception using errcode = '55000', message = 'published version assets are immutable';
    end if;

    if target_asset_type = 'reward' and exists (
      select 1
      from public.mission_rewards as reward
      join public.mission_versions as version on version.id = reward.mission_version_id
      where reward.character_asset_id = target_asset_id
        and version.published_at is not null
    ) then
      raise exception using errcode = '55000', message = 'published reward assets are immutable';
    end if;
  elsif exists (
      select 1 from public.mission_versions as version
      where version.id in (old_version_id, new_version_id)
        and version.published_at is not null
  ) then
    raise exception using errcode = '55000', message = 'published version assets are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

commit;
