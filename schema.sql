-- Run this once in Supabase: Project > SQL Editor > New Query > paste > Run

create table bins (
  id bigint generated always as identity primary key,
  label text not null,
  room text,
  notes text,
  created_at timestamptz default now()
);

create table items (
  id bigint generated always as identity primary key,
  bin_id bigint references bins(id) on delete cascade,
  name text not null
);

create table photos (
  id bigint generated always as identity primary key,
  bin_id bigint references bins(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz default now()
);

-- Locked down: only a signed-in session can read or write. Anyone hitting
-- the site without logging in gets bounced to login.html by the app, and
-- even if they skipped the app and hit the API directly, these policies
-- block them since there's no session token.
alter table bins enable row level security;
alter table items enable row level security;
alter table photos enable row level security;

create policy "authenticated full access bins" on bins
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access items" on items
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated full access photos" on photos
for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Storage bucket for photos. Reads stay public so <img> tags load without
-- juggling auth tokens; uploads require a signed-in session.
insert into storage.buckets (id, name, public)
values ('bin-photos', 'bin-photos', true)
on conflict (id) do nothing;

create policy "public read bin photos"
on storage.objects for select
using (bucket_id = 'bin-photos');

create policy "authenticated upload bin photos"
on storage.objects for insert
with check (bucket_id = 'bin-photos' and auth.role() = 'authenticated');
