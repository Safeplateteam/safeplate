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
