-- SafePlate MVP schema  ·  run once in Supabase SQL editor
create extension if not exists pgcrypto;

-- ───────────────────────── PGs ─────────────────────────
create table if not exists public.pgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  address       text,
  sector        text,
  lat           double precision,
  lng           double precision,
  verified      boolean not null default false,          -- "Verified by SafePlate"
  source        text not null default 'web' check (source in ('web','safeplate')),
  gender        text check (gender in ('boys','girls','coed')),
  rent_min      int,
  rent_max      int,
  meals         text,                                     -- e.g. "Breakfast + Dinner"
  amenities     text[] default '{}',                      -- wifi, ac, washing_machine, fridge, parking, cctv, ro_water ...
  photos        text[] default '{}',
  web_rating        numeric(2,1),                         -- public rating from the web
  web_review_count  int,
  ext_ref       text unique,                              -- scraper place id, for de-dupe
  -- team audit (filled during physical visit, 1–5 each)
  audit_food      numeric(2,1),
  audit_hygiene   numeric(2,1),
  audit_amenities numeric(2,1),
  audit_security  numeric(2,1),
  audit_notes     text,
  audit_checklist jsonb default '{}'::jsonb,
  verified_at   timestamptz,
  qr_code       text unique default substr(md5(gen_random_uuid()::text),1,8), -- for resident QR posters
  created_at    timestamptz not null default now()
);

-- ───────────────────────── Resident reviews ─────────────────────────
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pgs(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 40),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),   -- private, never exposed
  food        int not null check (food between 1 and 5),
  hygiene     int not null check (hygiene between 1 and 5),
  amenities   int not null check (amenities between 1 and 5),
  security    int not null check (security between 1 and 5),
  issues      text[] default '{}',          -- tags like oily, stale_food, pests, cctv_broken ...
  comment     text check (char_length(comment) <= 800),
  photos      text[] default '{}',
  months_stayed int,
  is_resident boolean not null default false,   -- true when submitted via the PG's QR code
  hidden      boolean not null default false,   -- team moderation
  created_at  timestamptz not null default now(),
  unique (pg_id, phone)
);

-- ───────────────────────── Reviews pulled from the web ─────────────────────────
create table if not exists public.web_reviews (
  id         uuid primary key default gen_random_uuid(),
  pg_id      uuid not null references public.pgs(id) on delete cascade,
  author     text,          -- first name + initial only
  rating     int,
  body       text,
  photos     text[] default '{}',
  posted     text,          -- e.g. "3 months ago"
  created_at timestamptz not null default now()
);

-- ───────────────────────── Decision test + analytics ─────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid references public.pgs(id) on delete set null,
  helped      boolean not null,               -- "Did this help you decide?"
  reason      text check (char_length(reason) <= 300),
  session_id  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.visit_requests (
  id          uuid primary key default gen_random_uuid(),
  pg_id       uuid not null references public.pgs(id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 40),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  move_in     text,
  message     text check (char_length(message) <= 300),
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id          bigint generated always as identity primary key,
  session_id  text,
  event       text not null check (char_length(event) <= 40),
  pg_id       uuid,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ───────────────────────── Public views (no phone numbers) ─────────────────────────
create or replace view public.reviews_public as
  select id, pg_id, name, food, hygiene, amenities, security, issues, comment,
         photos, months_stayed, is_resident, created_at
  from public.reviews where hidden = false;

create or replace view public.pg_scores as
  select p.id as pg_id,
         count(r.id)                         as review_count,
         round(avg(r.food)::numeric,1)       as food,
         round(avg(r.hygiene)::numeric,1)    as hygiene,
         round(avg(r.amenities)::numeric,1)  as amenities,
         round(avg(r.security)::numeric,1)   as security,
         -- Trust score: 60% residents + 40% team audit when both exist
         round((
           case
             when count(r.id) > 0 and p.audit_food is not null then
               0.6 * avg((r.food + r.hygiene + r.amenities + r.security) / 4.0)
             + 0.4 * ((p.audit_food + p.audit_hygiene + p.audit_amenities + p.audit_security) / 4.0)
             when count(r.id) > 0 then avg((r.food + r.hygiene + r.amenities + r.security) / 4.0)
             when p.audit_food is not null then (p.audit_food + p.audit_hygiene + p.audit_amenities + p.audit_security) / 4.0
           end)::numeric, 1)                 as trust_score
  from public.pgs p
  left join public.reviews r on r.pg_id = p.id and r.hidden = false
  group by p.id;

-- ───────────────────────── Row level security ─────────────────────────
alter table public.pgs            enable row level security;
alter table public.reviews        enable row level security;
alter table public.web_reviews    enable row level security;
alter table public.feedback       enable row level security;
alter table public.visit_requests enable row level security;
alter table public.events         enable row level security;

drop policy if exists "read pgs" on public.pgs;
create policy "read pgs" on public.pgs for select using (true);

drop policy if exists "read web reviews" on public.web_reviews;
create policy "read web reviews" on public.web_reviews for select using (true);

-- reviews: anyone can submit; nobody can read the raw table (phones stay private)
-- reviews are only written through public.submit_review() (no direct insert policy)
drop policy if exists "submit review" on public.reviews;
revoke insert, update, delete on public.reviews from anon, authenticated;

drop policy if exists "submit feedback" on public.feedback;
create policy "submit feedback" on public.feedback for insert with check (true);

drop policy if exists "submit visit" on public.visit_requests;
create policy "submit visit" on public.visit_requests for insert with check (status = 'new');

drop policy if exists "log event" on public.events;
create policy "log event" on public.events for insert with check (true);

grant select on public.reviews_public, public.pg_scores to anon, authenticated;

-- ───────────────────────── Team admin (passphrase, no login system) ─────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings(key, value)
  values ('admin_passphrase', 'sp-' || substr(md5(gen_random_uuid()::text), 1, 10))
  on conflict (key) do nothing;

create or replace function private.arr(j jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select case jsonb_typeof(j)
    when 'array'  then coalesce(array(select jsonb_array_elements_text(j)), '{}')
    when 'string' then case when j #>> '{}' like '[%' then coalesce(array(select jsonb_array_elements_text((j #>> '{}')::jsonb)), '{}')
                            else array[j #>> '{}'] end
    else '{}'::text[] end
$$;

create or replace function private.check_admin(pass text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if pass is null or pass <> (select value from private.settings where key = 'admin_passphrase') then
    perform pg_sleep(1);
    raise exception 'Wrong passphrase';
  end if;
end $$;

-- create or update a PG (team only)
create or replace function public.admin_save_pg(pass text, pg jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  perform private.check_admin(pass);
  if pg ? 'id' and (pg->>'id') is not null then
    update public.pgs set
      name = coalesce(pg->>'name', name),
      address = coalesce(pg->>'address', address),
      sector = coalesce(pg->>'sector', sector),
      lat = coalesce((pg->>'lat')::double precision, lat),
      lng = coalesce((pg->>'lng')::double precision, lng),
      gender = coalesce(pg->>'gender', gender),
      rent_min = coalesce((pg->>'rent_min')::int, rent_min),
      rent_max = coalesce((pg->>'rent_max')::int, rent_max),
      meals = coalesce(pg->>'meals', meals),
      amenities = case when pg ? 'amenities' then private.arr(pg->'amenities') else amenities end,
      photos = case when pg ? 'photos' then private.arr(pg->'photos') else photos end,
      audit_food = coalesce((pg->>'audit_food')::numeric, audit_food),
      audit_hygiene = coalesce((pg->>'audit_hygiene')::numeric, audit_hygiene),
      audit_amenities = coalesce((pg->>'audit_amenities')::numeric, audit_amenities),
      audit_security = coalesce((pg->>'audit_security')::numeric, audit_security),
      audit_notes = coalesce(pg->>'audit_notes', audit_notes),
      audit_checklist = coalesce(pg->'audit_checklist', audit_checklist),
      verified = coalesce((pg->>'verified')::boolean, verified),
      source = case when coalesce((pg->>'verified')::boolean, verified) then 'safeplate' else source end,
      verified_at = case when (pg->>'verified')::boolean and verified_at is null then now() else verified_at end
    where id = (pg->>'id')::uuid
    returning id into new_id;
  else
    insert into public.pgs (name, address, sector, lat, lng, gender, rent_min, rent_max, meals, amenities, photos,
                            audit_food, audit_hygiene, audit_amenities, audit_security, audit_notes, audit_checklist,
                            verified, source, verified_at)
    values (pg->>'name', pg->>'address', pg->>'sector', (pg->>'lat')::double precision, (pg->>'lng')::double precision,
            pg->>'gender', (pg->>'rent_min')::int, (pg->>'rent_max')::int, pg->>'meals',
            private.arr(pg->'amenities'),
            private.arr(pg->'photos'),
            (pg->>'audit_food')::numeric, (pg->>'audit_hygiene')::numeric, (pg->>'audit_amenities')::numeric,
            (pg->>'audit_security')::numeric, pg->>'audit_notes', coalesce(pg->'audit_checklist','{}'::jsonb),
            coalesce((pg->>'verified')::boolean, false),
            case when coalesce((pg->>'verified')::boolean, false) then 'safeplate' else 'web' end,
            case when coalesce((pg->>'verified')::boolean, false) then now() end)
    returning id into new_id;
  end if;
  return new_id;
end $$;

create or replace function public.admin_set_review_hidden(pass text, review_id uuid, is_hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  update public.reviews set hidden = is_hidden where id = review_id;
end $$;

-- dashboard numbers for the team / submission
create or replace function public.admin_dashboard(pass text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  return jsonb_build_object(
    'pgs_total',        (select count(*) from public.pgs),
    'pgs_verified',     (select count(*) from public.pgs where verified),
    'reviews',          (select count(*) from public.reviews),
    'resident_reviews', (select count(*) from public.reviews where is_resident),
    'helped_yes',       (select count(*) from public.feedback where helped),
    'helped_no',        (select count(*) from public.feedback where not helped),
    'visit_requests',   (select count(*) from public.visit_requests),
    'sessions',         (select count(distinct session_id) from public.events),
    'issue_counts',     (select coalesce(jsonb_object_agg(tag, n), '{}'::jsonb) from
                          (select unnest(issues) tag, count(*) n from public.reviews group by 1) t),
    'recent_reviews',   (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from
                          (select r.id, p.name pg, r.name, r.phone, r.food, r.hygiene, r.amenities, r.security,
                                  r.comment, r.is_resident, r.hidden, r.created_at
                           from public.reviews r join public.pgs p on p.id = r.pg_id
                           order by r.created_at desc limit 50) x),
    'visits',           (select coalesce(jsonb_agg(v order by v.created_at desc), '[]'::jsonb) from
                          (select vr.*, p.name pg from public.visit_requests vr join public.pgs p on p.id = vr.pg_id
                           order by vr.created_at desc limit 50) v)
  );
end $$;

-- resident review via QR: marks is_resident = true when the code matches the PG
create or replace function public.submit_review(r jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; resident boolean;
begin
  resident := exists(select 1 from public.pgs where id = (r->>'pg_id')::uuid and qr_code = r->>'qr');
  insert into public.reviews (pg_id, name, phone, food, hygiene, amenities, security, issues, comment, photos,
                              months_stayed, is_resident)
  values ((r->>'pg_id')::uuid, trim(r->>'name'), regexp_replace(r->>'phone', '\D', '', 'g'),
          (r->>'food')::int, (r->>'hygiene')::int, (r->>'amenities')::int, (r->>'security')::int,
          private.arr(r->'issues'), r->>'comment',
          private.arr(r->'photos'),
          (r->>'months_stayed')::int, resident)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You have already reviewed this PG with this phone number';
end $$;

revoke execute on function public.admin_save_pg, public.admin_set_review_hidden, public.admin_dashboard,
  public.submit_review from public;
grant execute on function public.admin_save_pg, public.admin_set_review_hidden, public.admin_dashboard,
  public.submit_review to anon, authenticated;

-- ───────────────────────── Photo storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "public read photos" on storage.objects;
create policy "public read photos" on storage.objects for select using (bucket_id = 'photos');
drop policy if exists "anyone upload review photos" on storage.objects;
create policy "anyone upload review photos" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = 'reviews');

select 'SafePlate schema ready' as status;
-- Explicit API grants (new Supabase projects don't auto-grant)
grant usage on schema public to anon, authenticated;
grant select on public.pgs, public.web_reviews to anon, authenticated;
grant select on public.reviews_public, public.pg_scores to anon, authenticated;
grant insert on public.feedback, public.visit_requests, public.events to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
revoke all on public.reviews from anon, authenticated;
grant execute on function public.submit_review(jsonb), public.admin_save_pg(text, jsonb),
  public.admin_set_review_hidden(text, uuid, boolean), public.admin_dashboard(text) to anon, authenticated;
select 'grants ok' as status;
