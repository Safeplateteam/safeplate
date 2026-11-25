-- SafePlate · weekly Gurgaon scraper, "Request this area", Phone.email verification
-- Safe to run more than once.

-- ───────────── extra PG fields ─────────────
alter table public.pgs add column if not exists last_seen_at timestamptz;
alter table public.pgs add column if not exists detail_level text default 'full';
alter table public.reviews add column if not exists phone_verified boolean not null default false;

create or replace view public.reviews_public as
  select id, pg_id, name, food, hygiene, amenities, security, issues, comment,
         photos, months_stayed, is_resident, created_at, phone_verified
  from public.reviews where hidden = false;
grant select on public.reviews_public to anon, authenticated;

-- ───────────── areas the scraper covers ─────────────
create table if not exists public.scrape_areas (
  id            serial primary key,
  name          text not null,
  priority      int  not null default 100,       -- 10 user request · 20 pilot · 50 core · 100 outer
  status        text not null default 'active' check (status in ('requested','active','rejected')),
  request_count int  not null default 0,
  basic_at      timestamptz,                    -- last listing-only sweep
  full_at       timestamptz,                    -- last photos + reviews scrape
  last_found    int,
  created_at    timestamptz not null default now()
);
create unique index if not exists scrape_areas_name_uq on public.scrape_areas (lower(name));
alter table public.scrape_areas enable row level security;
revoke all on public.scrape_areas from anon, authenticated;

-- seed Gurgaon (once)
insert into public.scrape_areas (name, priority)
select 'Sector ' || s,
       case when s in (28,29,30,31,32,40,41,42,43,44,45,46) then 20
            when s between 4 and 57 then 50 else 100 end
from generate_series(1, 115) s
on conflict do nothing;
insert into public.scrape_areas (name, priority)
select x, 50 from unnest(array[
  'DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Cyber City','Udyog Vihar',
  'MG Road','Golf Course Road','Sohna Road','South City 1','South City 2','Sushant Lok 1','Palam Vihar',
  'Nirvana Country','Sikanderpur','Nathupur','Chakkarpur','Wazirabad','Badshahpur','Ardee City','Old Gurgaon']) x
on conflict do nothing;
-- the pilot scrape (19 Nov) already covered these fully
update public.scrape_areas set basic_at = '2026-11-19', full_at = '2026-11-19', last_found = 58
 where name in ('Sector 29','Sector 30','Sector 31') and full_at is null;

-- ───────────── users: "Request this area" ─────────────
create or replace function public.request_area(area text) returns text
language plpgsql security definer set search_path = '' as $$
declare a text := initcap(regexp_replace(trim(coalesce(area,'')), '\s+', ' ', 'g'));
        st text;
begin
  if char_length(a) < 2 or char_length(a) > 60 then raise exception 'Please type an area name (2–60 letters)'; end if;
  insert into public.scrape_areas (name, priority, status, request_count) values (a, 10, 'requested', 1)
  on conflict (lower(name)) do update set request_count = public.scrape_areas.request_count + 1
  returning status into st;
  return case when st = 'active' then 'We already cover ' || a || '. New PGs there are added every week.'
              else 'Thanks! The SafePlate team will add ' || a || ' soon.' end;
end $$;
grant execute on function public.request_area(text) to anon, authenticated;

-- ───────────── team: manage areas ─────────────
create or replace function public.admin_areas(pass text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  return (select coalesce(jsonb_agg(a order by (a.status = 'requested') desc, a.priority, a.name), '[]'::jsonb)
          from public.scrape_areas a);
end $$;

create or replace function public.admin_set_area(pass text, area_id int, new_status text, new_priority int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  update public.scrape_areas set status = new_status, priority = coalesce(new_priority, priority) where id = area_id;
end $$;

create or replace function public.admin_add_area(pass text, area text, prio int default 10) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  insert into public.scrape_areas (name, priority, status) values (initcap(trim(area)), prio, 'active')
  on conflict (lower(name)) do update set status = 'active', priority = least(public.scrape_areas.priority, excluded.priority);
end $$;
grant execute on function public.admin_areas(text), public.admin_set_area(text, int, text, int),
  public.admin_add_area(text, text, int) to anon, authenticated;

-- ───────────── scraper robot (GitHub Actions) ─────────────
insert into private.settings(key, value)
  values ('scraper_key', 'sk-' || md5(gen_random_uuid()::text))
  on conflict (key) do nothing;
insert into private.settings(key, value) values ('require_verified_phone', 'false') on conflict (key) do nothing;

create or replace function private.check_scraper(k text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if k is null or k <> (select value from private.settings where key = 'scraper_key') then
    perform pg_sleep(1); raise exception 'Wrong scraper key';
  end if;
end $$;

create or replace function public.scraper_areas(k text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_scraper(k);
  return (select coalesce(jsonb_agg(a), '[]'::jsonb) from public.scrape_areas a where status = 'active');
end $$;

-- items: [{place_id,name,address,sector,lat,lng,gender,photos[],rating,review_count,reviews:[{author,rating,body,photos[],posted}]}]
create or replace function public.scraper_import(k text, area_id int, mode text, items jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare it jsonb; rv jsonb; pid uuid; n int := 0;
begin
  perform private.check_scraper(k);
  for it in select * from jsonb_array_elements(coalesce(items, '[]'::jsonb)) loop
    insert into public.pgs (name, address, sector, lat, lng, gender, photos, web_rating, web_review_count,
                            ext_ref, source, verified, detail_level, last_seen_at)
    values (it->>'name', it->>'address', it->>'sector', (it->>'lat')::float8, (it->>'lng')::float8, it->>'gender',
            private.arr(it->'photos'), (it->>'rating')::numeric, (it->>'review_count')::int,
            it->>'place_id', 'web', false, mode, now())
    on conflict (ext_ref) do update set
      -- never overwrite what the team entered for a Verified PG
      name    = case when public.pgs.verified then public.pgs.name else excluded.name end,
      address = coalesce(public.pgs.address, excluded.address),
      lat = coalesce(public.pgs.lat, excluded.lat), lng = coalesce(public.pgs.lng, excluded.lng),
      gender  = coalesce(public.pgs.gender, excluded.gender),
      photos  = case when public.pgs.verified or cardinality(public.pgs.photos) > cardinality(excluded.photos)
                     then public.pgs.photos else excluded.photos end,
      web_rating = coalesce(excluded.web_rating, public.pgs.web_rating),
      web_review_count = coalesce(excluded.web_review_count, public.pgs.web_review_count),
      detail_level = case when excluded.detail_level = 'full' then 'full' else public.pgs.detail_level end,
      last_seen_at = now()
    returning id into pid;
    if mode = 'full' and jsonb_typeof(it->'reviews') = 'array' then
      delete from public.web_reviews where pg_id = pid;
      for rv in select * from jsonb_array_elements(it->'reviews') loop
        insert into public.web_reviews (pg_id, author, rating, body, photos, posted)
        values (pid, rv->>'author', (rv->>'rating')::int, left(rv->>'body', 700), private.arr(rv->'photos'), rv->>'posted');
      end loop;
    end if;
    n := n + 1;
  end loop;
  update public.scrape_areas set last_found = n,
         basic_at = now(), full_at = case when mode = 'full' then now() else full_at end
   where id = area_id;
  return n;
end $$;
grant execute on function public.scraper_areas(text), public.scraper_import(text, int, text, jsonb) to anon, authenticated;

-- ───────────── Phone.email verification inside submit_review ─────────────
create extension if not exists http with schema extensions;

create or replace function private.verified_phone(pe_url text) returns text
language plpgsql security definer set search_path = '' as $$
declare res record; j jsonb;
begin
  if pe_url !~ '^https://user\.phone\.email/user_[A-Za-z0-9]+\.json$' then
    raise exception 'Phone verification link is not valid';
  end if;
  select * into res from extensions.http_get(pe_url);
  if res.status <> 200 then raise exception 'Could not confirm your phone number, please verify again'; end if;
  j := res.content::jsonb;
  if coalesce(j->>'user_country_code', '') not in ('+91', '91') then
    raise exception 'Please verify an Indian (+91) mobile number';
  end if;
  return regexp_replace(j->>'user_phone_number', '\D', '', 'g');
end $$;

create or replace function public.submit_review(r jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; resident boolean; ph text; verified boolean := false;
begin
  if coalesce(r->>'pe_url', '') <> '' then
    ph := private.verified_phone(r->>'pe_url'); verified := true;
  elsif (select value from private.settings where key = 'require_verified_phone') = 'true' then
    raise exception 'Please verify your phone number first';
  else
    ph := regexp_replace(r->>'phone', '\D', '', 'g');
  end if;
  resident := exists(select 1 from public.pgs where id = (r->>'pg_id')::uuid and qr_code = r->>'qr');
  insert into public.reviews (pg_id, name, phone, phone_verified, food, hygiene, amenities, security, issues, comment,
                              photos, months_stayed, is_resident)
  values ((r->>'pg_id')::uuid, trim(r->>'name'), right(ph, 10), verified,
          (r->>'food')::int, (r->>'hygiene')::int, (r->>'amenities')::int, (r->>'security')::int,
          private.arr(r->'issues'), r->>'comment', private.arr(r->'photos'),
          (r->>'months_stayed')::int, resident)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You have already reviewed this PG with this phone number';
end $$;
grant execute on function public.submit_review(jsonb) to anon, authenticated;

select 'areas + scraper + phone ready' as status, (select count(*) from public.scrape_areas) as areas;
