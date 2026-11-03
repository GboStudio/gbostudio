-- The Empty Museum / V4 — Public exhibition (READ-ONLY for visitors)
-- Run in a NEW Supabase project's SQL editor after reviewing every statement.
-- Publishing and payments MUST be handled by an authenticated, reviewed backend.
create extension if not exists pgcrypto;

create table if not exists public.museum_artworks (
  id uuid primary key default gen_random_uuid(),
  slot_type text not null check (slot_type in ('wall','floor','ceiling')),
  slot_index integer not null,
  title text not null check (char_length(title) between 1 and 100),
  artist_name text not null check (char_length(artist_name) between 1 and 80),
  category text not null default 'image' check (char_length(category) <= 30),
  tools text not null default '' check (char_length(tools) <= 100),
  description text not null default '' check (char_length(description) <= 650),
  image_url text,
  model_url text,
  owner_id uuid references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending','approved','published','rejected','expired')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_slot_index check (
    (slot_type='wall' and slot_index between 4 and 250) or
    (slot_type='floor' and slot_index between 1 and 5) or
    (slot_type='ceiling' and slot_index between 1 and 6)
  ),
  constraint published_requires_timestamp check
    (status <> 'published' or published_at is not null),
  constraint image_https_only check (image_url is null or image_url ~ '^https://'),
  constraint model_https_only check (model_url is null or model_url ~ '^https://')
);
-- Prevent selling or publishing the same slot twice.
create unique index if not exists museum_unique_published_slot
 on public.museum_artworks(slot_type,slot_index)
 where status='published';

create index if not exists museum_published_order
 on public.museum_artworks(published_at,id)
 where status='published';

alter table public.museum_artworks enable row level security;
revoke all on table public.museum_artworks from anon, authenticated;
-- Avoid exposing owner_id or private moderation fields.
grant select (id,slot_type,slot_index,title,artist_name,category,tools,description,image_url,model_url,published_at,status)
 on public.museum_artworks to anon,authenticated;

drop policy if exists "tem_public_published_read" on public.museum_artworks;
create policy "tem_public_published_read"
 on public.museum_artworks for select to anon,authenticated
 using (status='published' and published_at<=now());

-- Intentionally NO INSERT, UPDATE, DELETE policies for public clients.
-- Do not create public upload policies just to test the museum.
-- Publish only after rights verification, moderation, validation and payment.
