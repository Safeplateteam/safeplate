-- SafePlate · email OTP verification for reviews (Supabase Auth, no passwords). Safe to re-run.
alter table public.reviews add column if not exists email text;
alter table public.reviews alter column phone drop not null;
create unique index if not exists reviews_pg_email_uq on public.reviews (pg_id, lower(email)) where email is not null;

-- public view: add a single "verified" flag (phone OTP or email OTP); never exposes email or phone
create or replace view public.reviews_public as
  select id, pg_id, name, food, hygiene, amenities, security, issues, comment,
         photos, months_stayed, is_resident, created_at, phone_verified,
         (phone_verified or email is not null) as verified
  from public.reviews where hidden = false;
grant select on public.reviews_public to anon, authenticated;

insert into private.settings(key, value) values ('require_verified_email', 'false') on conflict (key) do nothing;

create or replace function public.submit_review(r jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; resident boolean; ph text; em text; pverified boolean := false;
begin
  -- signed in through the email code → take the verified email from the session, never from the request
  if auth.uid() is not null then
    em := lower(auth.jwt()->>'email');
  end if;
  if em is null and coalesce(r->>'pe_url', '') <> '' then
    ph := private.verified_phone(r->>'pe_url'); pverified := true;
  end if;
  if em is null and not pverified then
    if (select value from private.settings where key = 'require_verified_email') = 'true' then
      raise exception 'Please verify your email first';
    end if;
    ph := nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), '');
    if ph is null then raise exception 'Please verify your email first'; end if;
  end if;
  resident := exists(select 1 from public.pgs where id = (r->>'pg_id')::uuid and qr_code = r->>'qr');
  insert into public.reviews (pg_id, name, phone, email, phone_verified, food, hygiene, amenities, security, issues,
                              comment, photos, months_stayed, is_resident)
  values ((r->>'pg_id')::uuid, trim(r->>'name'), right(ph, 10), em, pverified,
          (r->>'food')::int, (r->>'hygiene')::int, (r->>'amenities')::int, (r->>'security')::int,
          private.arr(r->'issues'), r->>'comment', private.arr(r->'photos'),
          (r->>'months_stayed')::int, resident)
  returning id into new_id;
  return new_id;
exception when unique_violation then
  raise exception 'You have already reviewed this PG';
end $$;
grant execute on function public.submit_review(jsonb) to anon, authenticated;

-- admin dashboard: show email in the team's review list
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
                          (select r.id, p.name pg, r.name, coalesce(r.email, r.phone) as phone, r.food, r.hygiene,
                                  r.amenities, r.security, r.comment, r.is_resident, r.hidden, r.created_at
                           from public.reviews r join public.pgs p on p.id = r.pg_id
                           order by r.created_at desc limit 50) x),
    'visits',           (select coalesce(jsonb_agg(v order by v.created_at desc), '[]'::jsonb) from
                          (select vr.*, p.name pg from public.visit_requests vr join public.pgs p on p.id = vr.pg_id
                           order by vr.created_at desc limit 50) v)
  );
end $$;

select 'email otp ready' as status;
