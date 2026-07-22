-- Sistema de clasificados con requisitos, matches sugeridos e intereses.

-- ============================================================
-- 1. classifieds
-- ============================================================
create table public.classifieds (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('tripulante', 'profesor', 'barco', 'otro')),
  title text not null,
  description text not null,
  location text not null,
  location_worldwide boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'expired', 'archived')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  renewed_at timestamptz,
  views_count int not null default 0,
  contact_email text,
  contact_phone text
);

create index classifieds_author_id_idx on public.classifieds (author_id);
create index classifieds_category_idx on public.classifieds (category);
create index classifieds_status_idx on public.classifieds (status);
create index classifieds_expires_at_idx on public.classifieds (expires_at);
create index classifieds_location_idx on public.classifieds (location);

alter table public.classifieds enable row level security;

create policy "classifieds_select_active_or_own"
  on public.classifieds for select
  using (status = 'active' or auth.uid() = author_id);

create policy "classifieds_insert_own"
  on public.classifieds for insert
  with check (auth.uid() = author_id);

create policy "classifieds_update_own"
  on public.classifieds for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "classifieds_delete_own"
  on public.classifieds for delete
  using (auth.uid() = author_id);

-- ============================================================
-- 2. classified_requirements
-- ============================================================
create table public.classified_requirements (
  id uuid primary key default gen_random_uuid(),
  classified_id uuid not null references public.classifieds (id) on delete cascade,
  requirement_type text not null check (
    requirement_type in (
      'sailing_class',
      'experience_level',
      'role',
      'language',
      'availability'
    )
  ),
  requirement_value text not null,
  unique (classified_id, requirement_type, requirement_value)
);

create index classified_requirements_classified_id_idx
  on public.classified_requirements (classified_id);

alter table public.classified_requirements enable row level security;

create policy "classified_requirements_select_active_or_own"
  on public.classified_requirements for select
  using (
    exists (
      select 1
      from public.classifieds
      where classifieds.id = classified_id
        and (classifieds.status = 'active' or classifieds.author_id = auth.uid())
    )
  );
-- Insert/update/delete: solo service_role/backend.

-- ============================================================
-- 3. classified_matches
-- ============================================================
create table public.classified_matches (
  id uuid primary key default gen_random_uuid(),
  classified_id uuid not null references public.classifieds (id) on delete cascade,
  matched_user_id uuid not null references public.profiles (id) on delete cascade,
  match_score numeric not null check (match_score between 0 and 100),
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  unique (classified_id, matched_user_id)
);

create index classified_matches_classified_id_idx
  on public.classified_matches (classified_id);
create index classified_matches_matched_user_id_idx
  on public.classified_matches (matched_user_id);
create index classified_matches_match_score_idx
  on public.classified_matches (match_score desc);

alter table public.classified_matches enable row level security;

create policy "classified_matches_select_author_or_match"
  on public.classified_matches for select
  using (
    exists (
      select 1
      from public.classifieds
      where classifieds.id = classified_id
        and classifieds.author_id = auth.uid()
    )
    or matched_user_id = auth.uid()
  );
-- Insert/update/delete: solo service_role/backend.

-- ============================================================
-- 4. classified_interests
-- ============================================================
create table public.classified_interests (
  id uuid primary key default gen_random_uuid(),
  classified_id uuid not null references public.classifieds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  created_at timestamptz not null default now(),
  unique (classified_id, user_id)
);

create index classified_interests_classified_id_idx
  on public.classified_interests (classified_id);

alter table public.classified_interests enable row level security;

create policy "classified_interests_select_author_or_own"
  on public.classified_interests for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.classifieds
      where classifieds.id = classified_id
        and classifieds.author_id = auth.uid()
    )
  );

create policy "classified_interests_insert_own"
  on public.classified_interests for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 5. Índices para el matching de perfiles
-- ============================================================
create index profiles_sailing_class_idx on public.profiles (sailing_class);
create index profiles_usual_role_idx on public.profiles (usual_role);
-- profiles.language se indexará cuando se agregue esa columna al modelo.

-- ============================================================
-- 6. Expiración on-demand (invocable también desde Supabase Cron)
-- ============================================================
create or replace function public.expire_classifieds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.classifieds
  set status = 'expired'
  where status = 'active'
    and expires_at < now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke execute on function public.expire_classifieds() from public, anon, authenticated;
grant execute on function public.expire_classifieds() to service_role;

comment on function public.expire_classifieds() is
  'Marca como expired los clasificados activos cuyo expires_at ya pasó. '
  'El backend debe invocarla al listar clasificados y un cron nocturno puede invocarla diariamente.';