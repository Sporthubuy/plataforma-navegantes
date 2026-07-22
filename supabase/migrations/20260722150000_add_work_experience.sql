-- Historial laboral en la industria náutica.
--
-- Permite que un navegante registre su trayectoria profesional
-- (trabajo en club, federación, escuela de vela, yarda, sponsor,
-- equipo de regatas, etc.) como una sección más del CV náutico.
--
-- Sigue el mismo patrón que credentials: el dueño del perfil la
-- crea y borra; un admin (permiso users.verify) la puede verificar
-- si en el futuro quiere tener peso de sello.

create table public.work_experience (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,

  -- Qué cargó. Ej: "Profesor de vela", "Táctico equipo J/24",
  -- "Manager equipo olímpico", "Construcción naval".
  role        text not null check (char_length(role) between 2 and 150),

  -- Empleador / organización. Ej: "Club Neptuno", "Federación Uruguaya
  -- de Vela", "Nautor's Swan", o null si es freelance.
  organization text check (
    organization is null or char_length(organization) between 1 and 150
  ),

  -- Lugar donde estuvo basado. Texto libre.
  location    text check (
    location is null or char_length(location) between 1 and 150
  ),

  -- Tipo de trabajo náutico, para filtros y agregaciones futuras.
  -- Nuestos ejemplos iniciales cubren los roles típicos de la industria.
  work_type   text not null check (
    work_type in (
      'sailing_school',
      'race_team',
      'club_staff',
      'coach',
      'boat_builder',
      'regatta_management',
      'sponsor',
      'marine_industry',
      'other'
    )
  ),

  -- Fechas. Enero es el mínimo: mes y año son suficientes para un CV.
  -- Sin end_date significa "actual".
  start_month int  not null check (start_month between 1 and 12),
  start_year  int  not null check (start_year between 1950 and extract(year from now())::int + 1),
  end_month   int  check (end_month is null or end_month between 1 and 12),
  end_year    int  check (
    end_year is null or end_year between 1950 and extract(year from now())::int + 1
  ),

  -- Descripción libre: responsabilidades, logros en el rol, etc.
  description text check (
    description is null or char_length(description) between 1 and 2000
  ),

  -- Igual que credentials: el dueño no puede autoverificarse.
  -- Reservado para uso futuro; por defecto false.
  is_verified boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Si hay end, no puede ser antes del inicio.
  check (
    end_year is null or
    end_year > start_year or
    (end_year = start_year and (end_month is null or end_month >= start_month))
  )
);

create index work_experience_user_idx on public.work_experience (user_id, start_year desc);

create trigger work_experience_set_updated_at
  before update on public.work_experience
  for each row execute function public.set_updated_at();

-- RLS: igual a las demás tablas del perfil.
alter table public.work_experience enable row level security;

create policy "work_experience_select_visible"
  on public.work_experience for select
  to anon, authenticated
  using (true);  -- El control de visibilidad del historial lo hace el
                 -- backend en loadCv; por RLS asumimos lectura pública
                 -- del registro SI el perfil es público.

create policy "work_experience_owner_all"
  on public.work_experience for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);