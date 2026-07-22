-- Giro hacia comunidad.
--
-- El perfil deja de ser un ranking (regatas, 1ros, podios) y pasa a
-- medir participación: a cuánta gente le interesa lo que hacés, cuántas
-- veces saliste y cuánto navegaste.
--
-- Tres piezas:
--   1. Las salidas suman MILLAS NÁUTICAS, no solo horas, y son públicas:
--      viven en el feed del inicio, no en el legajo del perfil.
--   2. `follows`: seguir gente como en Twitter, sin reciprocidad.
--   3. `nautical_positions`: el cargo náutico (Comodoro, Entrenador…)
--      con institución y período, estilo LinkedIn.

-- ============================================================
-- 1. Millas náuticas en las salidas
-- ============================================================
alter table public.sailing_hours
  -- Hasta 99999.9 millas: una vuelta al mundo son ~27.000.
  add column distance_nm numeric(6, 1)
    check (distance_nm is null or (distance_nm >= 0 and distance_nm <= 99999.9)),
  -- Una salida se comparte por defecto: el feed es el punto.
  add column is_public boolean not null default true;

-- El feed del inicio ordena por fecha de salida entre las públicas.
create index sailing_hours_feed_idx
  on public.sailing_hours (sailed_date desc, created_at desc)
  where is_public;

comment on column public.sailing_hours.distance_nm is
  'Millas náuticas de la salida. Es la métrica que se muestra; las horas quedan como dato complementario.';
comment on column public.sailing_hours.is_public is
  'Las salidas alimentan el feed de la comunidad, no el legajo del perfil.';

-- ============================================================
-- 2. Seguimiento
-- ============================================================
create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  -- Seguirse a uno mismo no significa nada.
  check (follower_id <> following_id)
);

-- Contar seguidores y seguidos sin recorrer la tabla.
create index follows_following_idx on public.follows (following_id, created_at desc);
create index follows_follower_idx on public.follows (follower_id, created_at desc);

alter table public.follows enable row level security;

-- Quién sigue a quién es público: es lo que hace la red visible.
create policy "follows_select_public"
  on public.follows for select
  using (true);

create policy "follows_insert_own"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "follows_delete_own"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- ============================================================
-- 3. Cargos náuticos
-- ============================================================
create table public.nautical_positions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- Comodoro, Entrenador, Capitán de flota, Medida…
  title        text not null check (char_length(title) between 2 and 100),
  -- Club del catálogo si existe; si no, el nombre suelto.
  club_id      uuid references public.clubs (id) on delete set null,
  organization text check (organization is null or char_length(organization) between 2 and 150),
  start_date   date,
  end_date     date,
  -- Un cargo vigente no tiene fecha de fin.
  is_current   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date),
  check (not (is_current and end_date is not null))
);

create index nautical_positions_user_idx
  on public.nautical_positions (user_id, is_current desc, start_date desc);

create trigger nautical_positions_set_updated_at
  before update on public.nautical_positions
  for each row execute function public.set_updated_at();

alter table public.nautical_positions enable row level security;

create policy "positions_select_visible"
  on public.nautical_positions for select
  using (public.profile_is_visible(user_id));

create policy "positions_write_own"
  on public.nautical_positions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- 4. Números de comunidad
-- ============================================================
-- Reemplaza al bloque competitivo del perfil. Agregación en vivo: son
-- pocas filas por usuario y así no hay contadores que desincronizar.
create or replace view public.community_stats as
select
  p.id as user_id,
  (select count(*) from public.follows f where f.following_id = p.id) as followers_count,
  (select count(*) from public.follows f where f.follower_id = p.id) as following_count,
  (select count(*) from public.sailing_hours s where s.user_id = p.id) as outings_count,
  coalesce(
    (select sum(s.distance_nm) from public.sailing_hours s where s.user_id = p.id),
    0
  ) as total_nm,
  coalesce(
    (select sum(s.hours) from public.sailing_hours s where s.user_id = p.id),
    0
  ) as total_hours,
  (select max(s.sailed_date) from public.sailing_hours s where s.user_id = p.id) as last_sailed_date
from public.profiles p;
