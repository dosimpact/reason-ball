-- Additive authoring taxonomy; legacy missions stay unclassified.
create table public.mission_categories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  description text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  parent_id text,
  depth smallint not null check (depth in (0, 1)),
  parent_depth smallint generated always as (case when parent_id is not null then 0::smallint end) stored,
  unique (id, depth),
  check ((depth = 0 and parent_id is null) or (depth = 1 and parent_id is not null)),
  foreign key (parent_id, parent_depth) references public.mission_categories(id, depth) on delete restrict
);
create index mission_categories_parent_idx on public.mission_categories(parent_id, sort_order);
alter table public.mission_categories enable row level security;
revoke all on public.mission_categories from public, anon, authenticated;
grant select on public.mission_categories to anon, authenticated;
grant select, insert, update, delete on public.mission_categories to service_role;
create policy mission_categories_read on public.mission_categories for select to anon, authenticated using (true);

-- Composite FK permits only subcategories; no trigger or privileged function required.
alter table public.missions
  add column category_id text,
  add column category_depth smallint generated always as (1::smallint) stored,
  add constraint missions_category_fk foreign key (category_id, category_depth)
    references public.mission_categories(id, depth) on delete restrict;
create index missions_category_difficulty_idx on public.missions(category_id, difficulty);
comment on column public.missions.category_id is 'Optional subcategory ID. NULL means unclassified; scenario_category remains the legacy app field. No inferred backfill.';
comment on column public.missions.category_depth is 'Generated FK discriminator; category_id can reference depth 1 only.';

insert into public.mission_categories (id,name,description,sort_order,parent_id,depth) values
  ('daily','일상','생활 서비스와 일상적인 의사소통',0,null,0),
  ('travel','여행','여행 중 이동·숙박·관광과 문제 해결',1,null,0),
  ('social','관계','사람을 만나고 관계를 유지하는 대화',2,null,0),
  ('work','업무','직장·구직·협업에서 필요한 대화',3,null,0),
  ('food-drink','식당·카페','',0,'daily',1),
  ('shopping','쇼핑·교환·환불','',1,'daily',1),
  ('housing','주거·집안생활','',2,'daily',1),
  ('health','병원·약국','',3,'daily',1),
  ('services','은행·우편·생활 서비스','',4,'daily',1),
  ('routines','일과·취미·운동','',5,'daily',1),
  ('airport','공항·항공','',0,'travel',1),
  ('hotel','호텔·숙박','',1,'travel',1),
  ('transport','교통·길 찾기','',2,'travel',1),
  ('sightseeing','관광·문화 체험','',3,'travel',1),
  ('booking','일정·예약','',4,'travel',1),
  ('travel-problems','분실·여행 문제 해결','',5,'travel',1),
  ('introductions','첫 만남·자기소개','',0,'social',1),
  ('small-talk','안부·가벼운 대화','',1,'social',1),
  ('invitations','초대·약속','',2,'social',1),
  ('friends-family','친구·가족','',3,'social',1),
  ('feelings-opinions','감정·의견 표현','',4,'social',1),
  ('conflict-resolution','부탁·거절·사과','',5,'social',1),
  ('job-interviews','구직·면접','',0,'work',1),
  ('onboarding','입사·직장 적응','',1,'work',1),
  ('meetings','회의·의견 조율','',2,'work',1),
  ('collaboration','업무 요청·진행 공유','',3,'work',1),
  ('presentations','발표·설명','',4,'work',1),
  ('customer-service','고객 응대','',5,'work',1);
