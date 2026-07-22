-- Sistema de gamificación comunitaria.
--
-- Hoy el perfil premia podios, pero un navegante recreativo
-- (que sale los domingos sin competir) nunca va a tener uno. Para
-- que la comunidad crezca hacemos que "horas de mar" sea la
-- métrica central: competitivos y recreativos las acumulan por
-- igual, y desbloquean rangos náuticos (Aprendiz → Capitán) que
-- no suenan a free-to-play.
--
-- Dos métricas separadas:
--   - lifetime_hours  →  rango máximo alcanzado (no baja)
--   - last_30d_hours  →  estado activo/inactivo (recalculado)
-- Para mantenerse en un rango hay que navegar X horas en los
-- últimos 30 días. Eso convierte un número estático en hábito sin
-- penalizar vacaciones.
--
-- Hoy el único `source` es `'manual'`. Cuando conectemos Garmin u
-- otros wearables, esos van a insertar con `source='garmin'` y un
-- `external_id` único por sesión para no duplicar. El índice unique
-- partial (solo cuando external_id no es null) lo garantiza.

-- ============================================================
-- sailing_hours
-- ============================================================
create table public.sailing_hours (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,

  -- Fecha en que se navegó (sin hora: la jornada nautica queda bien con día).
  sailed_date  date not null check (sailed_date <= current_date),

  -- Cantidad de horas navegadas (fracción permitida para salidas cortas).
  hours        numeric(4,1) not null check (hours > 0 and hours <= 24),

  -- Clase / categoría del barco, texto libre.
  sailing_class text check (sailing_class is null or char_length(sailing_class) between 1 and 60),

  -- Barco de la plataforma si era uno propio/inscripto.
  boat_id      uuid references public.boats (id) on delete set null,

  -- Si la salida fue parte de una regata de la plataforma.
  regatta_id   uuid references public.regattas (id) on delete set null,

  -- Compañeros de tripulación (texto libre - la integración con crew_members vendrá después).
  crew_mates   text check (crew_mates is null or char_length(crew_mates) between 1 and 500),

  -- Notas del navegante sobre la salida.
  notes        text check (notes is null or char_length(notes) between 1 and 1000),

  -- 'manual' por ahora. 'garmin', 'apple_health', 'strava', etc. en el futuro.
  source       text not null default 'manual' check (source in ('manual', 'garmin', 'apple_health', 'strava', 'regatta_auto')),

  -- ID externo cuando viene de un wearable/sistema. Sirve para
  -- idempotencia: no insertar dos veces la misma sesión de Garmin.
  external_id  text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Una misma fuente externa no puede repetir ID para el mismo user.
  -- manual no tiene external_id, lo que permite múltiples entradas manuales.
  check (
    (source = 'manual' and external_id is null) or
    (source <> 'manual' and external_id is not null)
  )
);

create index sailing_hours_user_date_idx
  on public.sailing_hours (user_id, sailed_date desc);
create index sailing_hours_source_idx
  on public.sailing_hours (user_id, source);

create unique index sailing_hours_external_idx
  on public.sailing_hours (user_id, source, external_id)
  where external_id is not null;

create trigger sailing_hours_set_updated_at
  before update on public.sailing_hours
  for each row execute function public.set_updated_at();

alter table public.sailing_hours enable row level security;

create policy "sailing_hours_select_visible"
  on public.sailing_hours for select
  to anon, authenticated
  using (true);

create policy "sailing_hours_owner_insert"
  on public.sailing_hours for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "sailing_hours_owner_all"
  on public.sailing_hours for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- community_achievements — logros no competitivos
-- ============================================================
--
-- A diferencia de regatta_achievements que salen de regatas, estos
-- son generados por la plataforma cuando el navegante hace algo
-- bueno para la comunidad (publica, invita a alguien, responde,
-- participa en una jornada recreativa, etc.). Son idempotentes
-- por (user_id, achievement_type): no se puede tener "primer post"
-- dos veces.

create table public.community_achievements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  achievement_type text not null,
  -- Contexto libre: "publicó 'Primera travesía'", "invitó a Juan a Tempestad".
  description      text check (description is null or char_length(description) between 1 and 300),
  -- Timestamp del momento que generó el logro (no necesariamente ahora: puede
  -- ser retroactivo cuando relauchamos el sistema).
  earned_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  created_by       uuid references public.profiles (id) on delete set null
);

-- Tipos válidos.
alter table public.community_achievements
  add constraint community_achievements_type_chk check (
    achievement_type in (
      'first_post',
      'first_crew_invite_accepted',
      'event_organized',
      'event_participant',
      'mentorship_thank',
      'classified_matchmaker',
      'helpful_comment',
      'sailing_streak_30d',
      'sailing_streak_90d',
      'first_sailing_hours',
      '100_hours',
      '500_hours',
      '2000_hours'
    )
  );

create unique index community_achievements_unique_idx
  on public.community_achievements (user_id, achievement_type);

create index community_achievements_user_idx
  on public.community_achievements (user_id, earned_at desc);

alter table public.community_achievements enable row level security;

create policy "community_achievements_select_all"
  on public.community_achievements for select
  to anon, authenticated
  using (true);

-- Solo el backend (service role) inserta. El dueño del perfil no
-- puede generarse sus propios logros: es justamente lo que da
-- valor a los community_achievements.

-- ============================================================
-- sailor_ranks — vista que calcula el rango y el estado activo
-- ============================================================
--
-- Materializar el rango en la tabla perfiles era incómodo porque
-- exige mantenerlo actualizado ante cualquier cambio. Una vista
-- lo calcula en vivo desde sailing_hours sin costo de
-- consistencia y el backend lo consulta siempre.

create or replace function public.compute_sailor_rank(
  lifetime numeric
) returns text
language sql immutable
as $$
  select case
    when lifetime >= 2000 then 'captain'
    when lifetime >= 500  then 'master'
    when lifetime >= 100  then 'helmsman'
    when lifetime >= 25   then 'sailor'
    else 'apprentice'
  end
$$;

create or replace view public.sailor_ranks as
  with hours as (
    select
      user_id,
      sum(hours) as lifetime_hours,
      sum(hours) filter (
        where sailed_date >= current_date - interval '30 days'
      ) as last_30d_hours
    from public.sailing_hours
    group by user_id
  )
  select
    p.id as user_id,
    coalesce(h.lifetime_hours, 0) as lifetime_hours,
    coalesce(h.last_30d_hours, 0) as last_30d_hours,
    public.compute_sailor_rank(coalesce(h.lifetime_hours, 0)) as rank,
    -- Horas que el rango actual exige para mantenerse activo.
    case public.compute_sailor_rank(coalesce(h.lifetime_hours, 0))
      when 'captain'  then 20
      when 'master'   then 12
      when 'helmsman' then 8
      when 'sailor'   then 4
      else 0
    end as maintenance_threshold,
    -- Verdadero si navegó las horas de mantenimiento (o es apprentice).
    (
      public.compute_sailor_rank(coalesce(h.lifetime_hours, 0)) = 'apprentice'
      or coalesce(h.last_30d_hours, 0) >=
        case public.compute_sailor_rank(coalesce(h.lifetime_hours, 0))
          when 'captain'  then 20
          when 'master'   then 12
          when 'helmsman' then 8
          when 'sailor'   then 4
          else 0
        end
    ) as is_active
  from public.profiles p
  left join hours h on h.user_id = p.id;