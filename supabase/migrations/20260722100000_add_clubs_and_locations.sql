-- Clubes precargados + ubicaciones estructuradas (país ISO + ciudad).
--
-- Reemplaza los textos libres que había sueltos por todo el modelo:
--   profiles.club      -> profiles.club_id      (relación con clubs)
--   profiles.location  -> profiles.country/city
--   boats.home_port    -> boats.club_id
--   regattas.location  -> regattas.country/city + club_id (sede)
--   classifieds.location -> classifieds.country/city
--
-- Los clubes los administra el backend con la service role; el permiso
-- `clubs.manage` decide quién puede hacerlo. Hoy lo tiene solo el
-- administrador, pero el modelo ya soporta delegarlo.

-- ============================================================
-- clubs
-- ============================================================
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  -- Sigla o nombre corto (YCU, CNPE…).
  short_name text check (short_name is null or char_length(short_name) between 1 and 20),
  -- ISO 3166-1 alfa-2 en mayúsculas.
  country text not null check (country ~ '^[A-Z]{2}$'),
  city text check (city is null or char_length(city) between 1 and 100),
  website text check (website is null or website ~* '^https?://'),
  -- Cuando el club tenga su propia cuenta (profiles.account_type='club')
  -- se enlaza acá y deja de ser una ficha suelta.
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un mismo club no se carga dos veces en el mismo país,
-- sin importar mayúsculas ni espacios de más.
create unique index clubs_name_country_idx
  on public.clubs (lower(trim(name)), country);
create index clubs_country_city_idx on public.clubs (country, city);

alter table public.clubs enable row level security;

-- Lectura pública: los clubes son un catálogo.
create policy "clubs_select_public"
  on public.clubs for select
  using (true);

-- Sin políticas de escritura: solo el backend (service role) los modifica.

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row execute function public.set_updated_at();

-- ============================================================
-- Semilla: clubes de Uruguay
-- ============================================================
-- Lista inicial para que el selector no arranque vacío. Conviene
-- revisarla y completarla desde el panel de administración: los datos
-- de contacto y las sedes cambian.
insert into public.clubs (name, short_name, country, city) values
  ('Yacht Club Uruguayo', 'YCU', 'UY', 'Montevideo'),
  ('Club Nautilus', null, 'UY', 'Montevideo'),
  ('Club Náutico de Montevideo', null, 'UY', 'Montevideo'),
  ('Yacht Club Punta del Este', 'YCPE', 'UY', 'Punta del Este'),
  ('Club Náutico de Piriápolis', null, 'UY', 'Piriápolis'),
  ('Club Náutico de Colonia', null, 'UY', 'Colonia del Sacramento'),
  ('Club Náutico de Carmelo', null, 'UY', 'Carmelo'),
  ('Club Remeros Mercedes', null, 'UY', 'Mercedes'),
  ('Club Náutico de Paysandú', null, 'UY', 'Paysandú'),
  ('Club Náutico de Salto', null, 'UY', 'Salto'),
  ('Club Náutico de Atlántida', null, 'UY', 'Atlántida'),
  ('Club Náutico de Fray Bentos', null, 'UY', 'Fray Bentos'),
  ('Club Náutico de La Paloma', null, 'UY', 'La Paloma')
on conflict do nothing;

-- ============================================================
-- profiles: club_id + país/ciudad
-- ============================================================
alter table public.profiles
  add column club_id uuid references public.clubs (id) on delete set null,
  add column country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column city text check (city is null or char_length(city) between 1 and 100);

create index profiles_club_id_idx on public.profiles (club_id);

-- Lo que ya estaba escrito a mano y coincide con un club precargado se
-- conserva; el resto se descarta (había muy pocos datos cargados).
update public.profiles p
set club_id = c.id
from public.clubs c
where p.club is not null
  and lower(trim(p.club)) = lower(trim(c.name));

-- La zona de navegación libre pasa a ciudad si coincide con una
-- localidad conocida de algún club; si no, se descarta.
update public.profiles p
set country = 'UY', city = c.city
from public.clubs c
where p.location is not null
  and c.country = 'UY'
  and lower(trim(p.location)) = lower(trim(c.city));

alter table public.profiles
  drop column club,
  drop column location;

-- ============================================================
-- boats: club base
-- ============================================================
alter table public.boats
  add column club_id uuid references public.clubs (id) on delete set null;

create index boats_club_id_idx on public.boats (club_id);

update public.boats b
set club_id = c.id
from public.clubs c
where b.home_port is not null
  and lower(trim(b.home_port)) in (lower(trim(c.name)), lower(trim(c.city)));

alter table public.boats drop column home_port;

-- ============================================================
-- regattas: sede
-- ============================================================
alter table public.regattas
  add column country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column city text check (city is null or char_length(city) between 1 and 100),
  add column club_id uuid references public.clubs (id) on delete set null;

update public.regattas r
set country = 'UY', city = c.city, club_id = c.id
from public.clubs c
where r.location is not null
  and c.country = 'UY'
  and lower(trim(r.location)) in (lower(trim(c.name)), lower(trim(c.city)));

-- Lo que no matcheó con un club igual conserva su texto como ciudad:
-- una sede escrita a mano sigue siendo más útil que nada.
update public.regattas
set country = 'UY', city = left(trim(location), 100)
where location is not null and city is null and trim(location) <> '';

alter table public.regattas drop column location;

-- ============================================================
-- classifieds: ubicación del aviso
-- ============================================================
alter table public.classifieds
  add column country text check (country is null or country ~ '^[A-Z]{2}$'),
  add column city text check (city is null or char_length(city) between 1 and 100);

update public.classifieds
set country = 'UY', city = left(trim(location), 100)
where trim(location) <> '';

drop index if exists public.classifieds_location_idx;
alter table public.classifieds drop column location;

create index classifieds_location_idx on public.classifieds (country, city);

-- Un aviso que quedó sin ubicación pasa a ser de alcance mundial: es
-- eso o perderlo al agregar el CHECK de abajo.
update public.classifieds
set location_worldwide = true
where country is null;

-- Un aviso sin alcance mundial tiene que decir dónde es.
alter table public.classifieds
  add constraint classifieds_location_required
  check (location_worldwide or country is not null);

comment on table public.clubs is
  'Catálogo de clubes náuticos. Solo el backend (service role) escribe, con el permiso clubs.manage.';
comment on column public.clubs.profile_id is
  'Cuenta propia del club, cuando exista un profile con account_type=club.';
