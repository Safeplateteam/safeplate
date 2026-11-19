-- hide each PG's resident QR code from the public API (column-level grant)
revoke select on public.pgs from anon, authenticated;
grant select (id, name, address, sector, lat, lng, verified, source, gender, rent_min, rent_max, meals, amenities, photos,
              web_rating, web_review_count, ext_ref, audit_food, audit_hygiene, audit_amenities, audit_security,
              audit_notes, audit_checklist, verified_at, created_at) on public.pgs to anon, authenticated;

-- team-only: QR codes for posters
create or replace function public.admin_qr_codes(pass text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  return (select coalesce(jsonb_object_agg(id, qr_code), '{}'::jsonb) from public.pgs);
end $$;
grant execute on function public.admin_qr_codes(text) to anon, authenticated;
select 'qr hidden' as status;
