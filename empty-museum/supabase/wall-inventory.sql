-- THE UNREAL MUSEUM · Mur Total inventory migration
-- Apply AFTER supabase/schema.sql in a project reviewed by the technical owner.
-- No payment, no public reservation API and no customer upload are created here.
-- All writes are reserved for a trusted server-side process.

create table if not exists public.museum_wall_licenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),
  module_index integer not null check (module_index between 1 and 40),
  side text not null check (side in ('left','right')),
  status text not null default 'draft'
    check (status in ('draft','held','payment_pending','moderation_pending','active','expired','canceled','rejected')),
  hold_expires_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint wall_validity_check check (
    valid_until is null or (valid_from is not null and valid_until > valid_from)
  ),
  constraint held_has_expiry check (
    status <> 'held' or hold_expires_at is not null
  )
);
create table if not exists public.museum_wall_slot_claims (
  id uuid primary key default gen_random_uuid(),
  slot_index integer not null check (slot_index between 4 and 250),
  artwork_id uuid references public.museum_artworks(id) on delete cascade,
  wall_license_id uuid references public.museum_wall_licenses(id) on delete cascade,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint claim_has_one_owner check (
    (artwork_id is not null) <> (wall_license_id is not null)
  )
);
-- One active claim per individual bay across both FRAME and MUR TOTAL products.
create unique index if not exists museum_unique_active_wall_claim
  on public.museum_wall_slot_claims (slot_index)
  where released_at is null;

alter table public.museum_wall_licenses enable row level security;
alter table public.museum_wall_slot_claims enable row level security;
revoke all on table public.museum_wall_licenses from anon, authenticated;
revoke all on table public.museum_wall_slot_claims from anon, authenticated;

-- A published wall artwork claims one bay. Its slot cannot be silently moved.
create or replace function public.tem_sync_artwork_slot_claim()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and old.status='published' and (
      old.slot_type is distinct from new.slot_type or
      old.slot_index is distinct from new.slot_index
  ) then
    raise exception 'Cannot move a published artwork: expire it before reassignment';
  end if;
  if new.slot_type='wall' then
    if new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published') then
      insert into public.museum_wall_slot_claims(slot_index,artwork_id)
        values (new.slot_index,new.id);
    elsif tg_op='UPDATE' and old.status='published' and new.status<>'published' then
      update public.museum_wall_slot_claims set released_at=now()
        where artwork_id=old.id and released_at is null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists tem_claim_published_wall_art on public.museum_artworks;
create trigger tem_claim_published_wall_art
after insert or update of status,slot_type,slot_index on public.museum_artworks
for each row execute function public.tem_sync_artwork_slot_claim();

-- Existing publications are migrated into the shared anti-overlap inventory.
-- If this fails, inspect conflicts; do NOT ignore them.
insert into public.museum_wall_slot_claims(slot_index,artwork_id)
select slot_index,id from public.museum_artworks
where status='published' and slot_type='wall'
  and not exists (
    select 1 from public.museum_wall_slot_claims c
    where c.artwork_id=public.museum_artworks.id and c.released_at is null
  );

-- The 3 bay IDs of module 1 (slots 6..11) are
-- LEFT=[6,8,10], RIGHT=[7,9,11]. Each is inserted atomically.
create or replace function public.tem_sync_mur_total_claims()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare
  base_idx integer;
  offset_idx integer;
begin
  if tg_op='UPDATE' and (
    old.module_index is distinct from new.module_index or old.side is distinct from new.side
  ) then
    raise exception 'Cannot move a Mur Total license; cancel and create a new one';
  end if;
  if new.status in ('held','payment_pending','moderation_pending','active')
     and (tg_op='INSERT' or old.status not in ('held','payment_pending','moderation_pending','active'))
  then
    base_idx := new.module_index*6;
    if new.side='right' then base_idx:=base_idx+1; end if;
    for offset_idx in 0..2 loop
      insert into public.museum_wall_slot_claims(slot_index,wall_license_id)
      values (base_idx+offset_idx*2,new.id);
    end loop;
  elsif tg_op='UPDATE' and old.status in ('held','payment_pending','moderation_pending','active')
        and new.status in ('expired','canceled','rejected')
  then
    update public.museum_wall_slot_claims set released_at=now()
    where wall_license_id=new.id and released_at is null;
  end if;
  return new;
end $$;
drop trigger if exists tem_claim_mur_total on public.museum_wall_licenses;
create trigger tem_claim_mur_total
after insert or update of status,module_index,side on public.museum_wall_licenses
for each row execute function public.tem_sync_mur_total_claims();

-- Do not expose privileged trigger functions as public RPCs.
revoke all on function public.tem_sync_artwork_slot_claim() from public, anon, authenticated;
revoke all on function public.tem_sync_mur_total_claims() from public, anon, authenticated;
-- Operational requirements still missing: validated checkout webhooks,
-- expiring holds, moderation decisions, rights checks, VAT and refund processes.
