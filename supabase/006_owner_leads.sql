-- SafePlate · PG owners asking to get listed / verified. Safe to re-run.
create table if not exists public.owner_leads (
  id         uuid primary key default gen_random_uuid(),
  owner_name text not null check (char_length(owner_name) between 2 and 60),
  phone      text not null check (phone ~ '^[6-9][0-9]{9}$'),
  pg_name    text not null check (char_length(pg_name) between 2 and 100),
  area       text check (char_length(area) <= 120),
  beds       int,
  message    text check (char_length(message) <= 400),
  status     text not null default 'new' check (status in ('new','contacted','onboarded','rejected')),
  created_at timestamptz not null default now()
);
alter table public.owner_leads enable row level security;
drop policy if exists "submit owner lead" on public.owner_leads;
create policy "submit owner lead" on public.owner_leads for insert with check (status = 'new');
revoke all on public.owner_leads from anon, authenticated;
grant insert on public.owner_leads to anon, authenticated;

create or replace function public.admin_owner_leads(pass text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  return (select coalesce(jsonb_agg(o order by o.created_at desc), '[]'::jsonb) from public.owner_leads o);
end $$;

create or replace function public.admin_set_owner_lead(pass text, lead_id uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_admin(pass);
  update public.owner_leads set status = new_status where id = lead_id;
end $$;
grant execute on function public.admin_owner_leads(text), public.admin_set_owner_lead(text, uuid, text) to anon, authenticated;

select 'owner leads ready' as status;
