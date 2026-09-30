begin;

-- No backfill: current base rows cannot prove historical names or difficulty.
alter table public.character_versions add column display_metadata jsonb
  check (display_metadata is null or jsonb_typeof(display_metadata) = 'object');
alter table public.mission_versions add column display_metadata jsonb
  check (display_metadata is null or jsonb_typeof(display_metadata) = 'object');

create function public.capture_version_display_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.published_at is not null then
      -- The existing immutability trigger rejects any published-row mutation.
      return new;
    end if;
  end if;
  new.display_metadata := null;
  if new.published_at is null then return new; end if;

  if tg_table_name = 'character_versions' then
    select jsonb_build_object(
      'schemaVersion', 1, 'name', base.name, 'tagline', base.tagline,
      'description', base.description,
      'tags', coalesce((select jsonb_agg(tag.tag order by tag.tag)
        from public.character_tags tag where tag.character_id = base.id), '[]'::jsonb)
    ) into new.display_metadata
    from public.characters base where base.id = new.character_id;
  else
    select jsonb_build_object(
      'schemaVersion', 1, 'title', base.title, 'summary', base.summary,
      'scenario_category', base.scenario_category, 'difficulty', base.difficulty,
      'estimated_minutes', base.estimated_minutes
    ) into new.display_metadata
    from public.missions base where base.id = new.mission_id;
  end if;
  if new.display_metadata is null then
    raise exception 'Version display metadata source is missing' using errcode = '23503';
  end if;
  return new;
end;
$$;

revoke all on function public.capture_version_display_metadata() from public, anon, authenticated;

create trigger character_versions_capture_display_metadata
before insert or update on public.character_versions
for each row execute function public.capture_version_display_metadata();
create trigger mission_versions_capture_display_metadata
before insert or update on public.mission_versions
for each row execute function public.capture_version_display_metadata();

comment on column public.character_versions.display_metadata is
  'Public display fields captured by the database on first publication; NULL means historical metadata is unknown.';
comment on column public.mission_versions.display_metadata is
  'Public display fields captured by the database on first publication; NULL means historical metadata is unknown. Does not define reward grants.';

commit;
