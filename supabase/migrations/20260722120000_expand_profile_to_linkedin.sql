-- Perfil de navegante como CV profesional náutico.
--
-- Agrega cuatro piezas sobre el perfil que ya existe (no lo reemplaza):
--   credentials          — títulos, certificaciones y experiencia laboral
--   regatta_achievements — historial de logros (automático + manual)
--   professional_summary — headline, bio profesional y disponibilidad
--   achievement_stats    — contadores desnormalizados para ranking/búsqueda
--
-- El cálculo de la posición final NO vive acá: requiere Low Point,
-- descartes y penalizaciones, que ya están implementados y testeados en
-- backend/src/lib/scoring.ts. Reimplementarlos en plpgsql duplicaría el
-- código más delicado de la app y las dos copias se irían separando.
-- Postgres solo agrega los contadores (refresh_achievement_stats).

-- ============================================================
-- credentials
-- ============================================================
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  credential_type text not null check (
    credential_type in ('instructor', 'coach', 'sailor_level', 'experience', 'other')
  ),
  title text not null check (char_length(title) between 2 and 150),
  issuer text check (issuer is null or char_length(issuer) between 1 and 150),
  issue_date date,
  -- null = no vence.
  expiry_date date,
  credential_url text check (credential_url is null or credential_url ~* '^https?://'),
  -- Solo lo cambia un admin con users.verify_credentials.
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);

create index credentials_user_id_idx on public.credentials (user_id);
create index credentials_type_idx on public.credentials (credential_type);

create trigger credentials_set_updated_at
  before update on public.credentials
  for each row execute function public.set_updated_at();

-- ============================================================
-- regatta_achievements
-- ============================================================
create table public.regatta_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_type text not null check (
    achievement_type in
      ('1st_place', '2nd_place', '3rd_place', 'podium', 'best_class', 'regatta_finished')
  ),
  -- null en los históricos cargados a mano (regatas previas a la app).
  regatta_id uuid references public.regattas (id) on delete set null,
  regatta_class_id uuid references public.regatta_classes (id) on delete set null,
  regatta_name text not null check (char_length(regatta_name) between 2 and 200),
  regatta_class text,
  regatta_date date not null,
  position int check (position is null or position > 0),
  total_entries int check (total_entries is null or total_entries > 0),
  boat_name text,
  -- true = lo declaró el usuario; false = lo generó la app desde una regata.
  is_manual boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  -- Un logro manual no puede colgar de una regata de la app, y uno
  -- automático siempre tiene de dónde vino.
  check ((is_manual and regatta_id is null) or (not is_manual and regatta_id is not null))
);

create index regatta_achievements_user_date_idx
  on public.regatta_achievements (user_id, regatta_date desc);
create index regatta_achievements_type_idx
  on public.regatta_achievements (user_id, achievement_type);

-- Idempotencia de la sincronización: un usuario tiene como mucho un
-- logro por clase de regata, así que recargar resultados actualiza en
-- vez de duplicar.
create unique index regatta_achievements_sync_idx
  on public.regatta_achievements (user_id, regatta_class_id)
  where regatta_class_id is not null;

-- ============================================================
-- professional_summary
-- ============================================================
-- Una fila por usuario: user_id es la PK (no hace falta un id aparte).
create table public.professional_summary (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  headline text check (headline is null or char_length(headline) <= 160),
  professional_bio text check (professional_bio is null or char_length(professional_bio) <= 2000),
  specialties text[] not null default '{}',
  experience_years int check (experience_years is null or experience_years between 0 and 90),
  seeking_role text check (
    seeking_role is null
    or seeking_role in ('tripulante', 'entrenador', 'ambos', 'socio_de_regata')
  ),
  preferred_classes text[] not null default '{}',
  availability_status text not null default 'selective'
    check (availability_status in ('available', 'not_available', 'selective')),
  updated_at timestamptz not null default now()
);

create index professional_summary_seeking_idx
  on public.professional_summary (seeking_role, availability_status);
-- GIN para que el buscador filtre por especialidad sin recorrer todo.
create index professional_summary_specialties_idx
  on public.professional_summary using gin (specialties);
create index professional_summary_classes_idx
  on public.professional_summary using gin (preferred_classes);

create trigger professional_summary_set_updated_at
  before update on public.professional_summary
  for each row execute function public.set_updated_at();

-- ============================================================
-- achievement_stats
-- ============================================================
create table public.achievement_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_regattas_sailed int not null default 0,
  total_1st_places int not null default 0,
  total_podiums int not null default 0,
  best_class text,
  sailing_since_year int,
  last_regatta_date date,
  verified_credentials_count int not null default 0,
  updated_at timestamptz not null default now()
);

create index achievement_stats_ranking_idx
  on public.achievement_stats (total_regattas_sailed desc, total_podiums desc);

-- ============================================================
-- profiles: verificación y visibilidad
-- ============================================================
alter table public.profiles
  add column verified_badge boolean not null default false,
  add column public_profile boolean not null default true;

-- ============================================================
-- Recálculo de contadores
-- ============================================================
-- Agregación pura sobre lo ya guardado: se puede correr las veces que
-- haga falta y siempre deja el mismo resultado.
create or replace function public.refresh_achievement_stats(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.achievement_stats as s (
    user_id,
    total_regattas_sailed,
    total_1st_places,
    total_podiums,
    best_class,
    sailing_since_year,
    last_regatta_date,
    verified_credentials_count,
    updated_at
  )
  select
    target_user,
    count(*),
    count(*) filter (where a.achievement_type = '1st_place'),
    count(*) filter (
      where a.achievement_type in ('1st_place', '2nd_place', '3rd_place', 'podium')
    ),
    -- Clase con más podios; si nadie subió al podio, la más navegada.
    (
      select a2.regatta_class
      from public.regatta_achievements a2
      where a2.user_id = target_user and a2.regatta_class is not null
      group by a2.regatta_class
      order by
        count(*) filter (
          where a2.achievement_type in ('1st_place', '2nd_place', '3rd_place', 'podium')
        ) desc,
        count(*) desc,
        a2.regatta_class
      limit 1
    ),
    extract(year from min(a.regatta_date))::int,
    max(a.regatta_date),
    (
      select count(*)
      from public.credentials c
      where c.user_id = target_user and c.is_verified
    ),
    now()
  from public.regatta_achievements a
  where a.user_id = target_user
  on conflict (user_id) do update set
    total_regattas_sailed = excluded.total_regattas_sailed,
    total_1st_places = excluded.total_1st_places,
    total_podiums = excluded.total_podiums,
    best_class = excluded.best_class,
    sailing_since_year = excluded.sailing_since_year,
    last_regatta_date = excluded.last_regatta_date,
    verified_credentials_count = excluded.verified_credentials_count,
    updated_at = now();

  -- Un usuario sin logros igual necesita su fila en cero, para que el
  -- buscador y el perfil no tengan que contemplar el caso "sin fila".
  insert into public.achievement_stats (user_id, verified_credentials_count)
  select
    target_user,
    (select count(*) from public.credentials c where c.user_id = target_user and c.is_verified)
  on conflict (user_id) do update set
    verified_credentials_count = excluded.verified_credentials_count,
    updated_at = now();
end;
$$;

-- Cualquier cambio en logros o credenciales deja los contadores al día
-- sin que el backend tenga que acordarse de pedirlo.
create or replace function public.trg_refresh_achievement_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_achievement_stats(
    coalesce(new.user_id, old.user_id)
  );
  return null;
end;
$$;

create trigger regatta_achievements_refresh_stats
  after insert or update or delete on public.regatta_achievements
  for each row execute function public.trg_refresh_achievement_stats();

create trigger credentials_refresh_stats
  after insert or update or delete on public.credentials
  for each row execute function public.trg_refresh_achievement_stats();

-- ============================================================
-- RLS
-- ============================================================
alter table public.credentials enable row level security;
alter table public.regatta_achievements enable row level security;
alter table public.professional_summary enable row level security;
alter table public.achievement_stats enable row level security;

-- ¿El perfil es público, o soy yo mirándome?
create or replace function public.profile_is_visible(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.public_profile from public.profiles p where p.id = target_user),
    false
  ) or auth.uid() = target_user;
$$;

create policy "credentials_select_visible"
  on public.credentials for select
  using (public.profile_is_visible(user_id));

create policy "credentials_write_own"
  on public.credentials for insert
  with check (auth.uid() = user_id);

create policy "credentials_update_own"
  on public.credentials for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "credentials_delete_own"
  on public.credentials for delete
  using (auth.uid() = user_id);

create policy "achievements_select_visible"
  on public.regatta_achievements for select
  using (public.profile_is_visible(user_id));

-- Solo los manuales: los automáticos los escribe el backend con la
-- service role, y borrarlos rompería la trazabilidad con la regata.
create policy "achievements_insert_own_manual"
  on public.regatta_achievements for insert
  with check (auth.uid() = user_id and is_manual);

create policy "achievements_update_own_manual"
  on public.regatta_achievements for update
  using (auth.uid() = user_id and is_manual)
  with check (auth.uid() = user_id and is_manual);

create policy "achievements_delete_own_manual"
  on public.regatta_achievements for delete
  using (auth.uid() = user_id and is_manual);

create policy "summary_select_visible"
  on public.professional_summary for select
  using (public.profile_is_visible(user_id));

create policy "summary_insert_own"
  on public.professional_summary for insert
  with check (auth.uid() = user_id);

create policy "summary_update_own"
  on public.professional_summary for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Los contadores son públicos: alimentan rankings y el buscador.
create policy "stats_select_public"
  on public.achievement_stats for select
  using (true);

-- Sin políticas de escritura: los contadores solo los mueve el trigger.

comment on table public.regatta_achievements is
  'Historial de logros. is_manual=false lo genera la app al cerrar una clase (tiene autoridad); is_manual=true lo declara el usuario.';
comment on function public.refresh_achievement_stats(uuid) is
  'Recalcula los contadores de un usuario desde cero. Idempotente.';

-- ============================================================
-- Permiso nuevo: verificar credenciales
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
      'users.verify',
      'boats.view_all',
      'boats.edit_all',
      'boats.create_all',
      'regattas.create',
      'regattas.edit',
      'regattas.delete',
      'regattas.manage_results',
      'clubs.manage'
    )
  );
