-- Sistema de inscripción de regatas: regatas, inscripciones, mangas y
-- resultados (modelo estándar de la vela, Low Point System).

-- ============================================================
-- regattas
-- ============================================================
create table public.regattas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  description text,
  sailing_class text not null check (char_length(sailing_class) between 1 and 50),
  location text,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming'
    check (status in ('upcoming', 'open', 'in_progress', 'finished', 'cancelled')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  max_entries int check (max_entries is null or max_entries > 0),
  scoring_system text not null default 'low_point',
  discards_count int not null default 0 check (discards_count >= 0),
  photo_url text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index regattas_status_idx on public.regattas (status);
create index regattas_sailing_class_idx on public.regattas (sailing_class);

alter table public.regattas enable row level security;

create policy "regattas_select_public"
  on public.regattas for select using (true);
-- Escritura: solo backend (service role). Sin policies de write para clientes.

create trigger regattas_set_updated_at
  before update on public.regattas
  for each row execute function public.set_updated_at();

-- ============================================================
-- regatta_entries (inscripciones)
-- ============================================================
create table public.regatta_entries (
  id uuid primary key default gen_random_uuid(),
  regatta_id uuid not null references public.regattas (id) on delete cascade,
  boat_id uuid not null references public.boats (id) on delete cascade,
  registered_by uuid not null references public.profiles (id) on delete cascade,
  sail_number text,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'withdrawn')),
  registered_at timestamptz not null default now(),
  unique (regatta_id, boat_id)
);

create index regatta_entries_regatta_id_idx on public.regatta_entries (regatta_id);
create index regatta_entries_boat_id_idx on public.regatta_entries (boat_id);

alter table public.regatta_entries enable row level security;

create policy "regatta_entries_select_public"
  on public.regatta_entries for select using (true);

-- Inscribe el owner del barco (o quien tenga permiso, vía backend).
create policy "regatta_entries_insert_owner"
  on public.regatta_entries for insert
  with check (
    auth.uid() = registered_by
    and exists (
      select 1 from public.boats
      where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

-- Retirar/actualizar la propia inscripción (o el owner del barco).
create policy "regatta_entries_update_own"
  on public.regatta_entries for update
  using (
    auth.uid() = registered_by
    or exists (
      select 1 from public.boats
      where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

-- ============================================================
-- races (mangas)
-- ============================================================
create table public.races (
  id uuid primary key default gen_random_uuid(),
  regatta_id uuid not null references public.regattas (id) on delete cascade,
  race_number int not null check (race_number > 0),
  name text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed')),
  sailed_at timestamptz,
  unique (regatta_id, race_number)
);

create index races_regatta_id_idx on public.races (regatta_id);

alter table public.races enable row level security;

create policy "races_select_public"
  on public.races for select using (true);
-- Escritura: solo backend (service role).

-- ============================================================
-- race_results (resultado de un barco en una manga)
-- ============================================================
create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  race_id uuid not null references public.races (id) on delete cascade,
  entry_id uuid not null references public.regatta_entries (id) on delete cascade,
  position int check (position is null or position > 0),
  points numeric not null,
  code text check (
    code is null or code in ('DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET')
  ),
  unique (race_id, entry_id)
);

create index race_results_race_id_idx on public.race_results (race_id);
create index race_results_entry_id_idx on public.race_results (entry_id);

alter table public.race_results enable row level security;

create policy "race_results_select_public"
  on public.race_results for select using (true);
-- Escritura: solo backend (service role).

-- ============================================================
-- Permisos nuevos en el catálogo de user_permissions
-- ============================================================
alter table public.user_permissions
  drop constraint if exists user_permissions_permission_check;

alter table public.user_permissions
  add constraint user_permissions_permission_check check (
    permission in (
      'users.view',
      'users.suspend',
      'users.delete',
      'users.grant_permissions',
      'boats.view_all',
      'boats.edit_all',
      'boats.create_all',
      'regattas.create',
      'regattas.edit',
      'regattas.delete',
      'regattas.manage_results'
    )
  );
