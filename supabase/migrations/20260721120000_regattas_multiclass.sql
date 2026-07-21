-- Refactor: de "una regata = una clase" a "un campeonato con varias clases".
-- Las mangas, inscripciones y resultados pasan a colgar de la CLASE.
-- Migra los datos existentes sin pérdida (verificación antes de limpiar).

-- ============================================================
-- 1. regatta_classes (flotas/divisiones del campeonato)
-- ============================================================
create table public.regatta_classes (
  id uuid primary key default gen_random_uuid(),
  regatta_id uuid not null references public.regattas (id) on delete cascade,
  sailing_class text not null check (char_length(sailing_class) between 1 and 50),
  discards_count int not null default 0 check (discards_count >= 0),
  max_entries int check (max_entries is null or max_entries > 0),
  status text not null default 'upcoming'
    check (status in ('upcoming', 'open', 'in_progress', 'finished', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (regatta_id, sailing_class)
);

comment on table public.regatta_classes is
  'Clase/flota de un campeonato. Cada una corre por separado: sus propias '
  'mangas, inscripciones, resultados, descartes y estado.';

-- ============================================================
-- 2. Columnas nuevas (nullable por ahora, para poder migrar)
-- ============================================================
alter table public.races
  add column regatta_class_id uuid references public.regatta_classes (id) on delete cascade;

alter table public.regatta_entries
  add column regatta_class_id uuid references public.regatta_classes (id) on delete cascade;

-- ============================================================
-- 3. Migración de datos existentes
-- ============================================================

-- Una clase por cada regata existente, copiando su clase/descartes/estado.
insert into public.regatta_classes (regatta_id, sailing_class, discards_count, max_entries, status)
select id, sailing_class, discards_count, max_entries, status
from public.regattas;

-- Reapuntar mangas e inscripciones a la clase recién creada.
update public.races r
set regatta_class_id = rc.id
from public.regatta_classes rc
where rc.regatta_id = r.regatta_id;

update public.regatta_entries e
set regatta_class_id = rc.id
from public.regatta_classes rc
where rc.regatta_id = e.regatta_id;

-- Verificación: nada puede quedar huérfano. Si falla, aborta toda la migración.
do $$
declare
  orphan_races int;
  orphan_entries int;
begin
  select count(*) into orphan_races
    from public.races where regatta_class_id is null;
  if orphan_races > 0 then
    raise exception 'Migración abortada: % mangas sin regatta_class_id', orphan_races;
  end if;

  select count(*) into orphan_entries
    from public.regatta_entries where regatta_class_id is null;
  if orphan_entries > 0 then
    raise exception 'Migración abortada: % inscripciones sin regatta_class_id', orphan_entries;
  end if;
end $$;

-- ============================================================
-- 4. Limpieza del modelo viejo (post-verificación)
-- ============================================================
alter table public.races alter column regatta_class_id set not null;
alter table public.regatta_entries alter column regatta_class_id set not null;

-- La numeración de mangas ahora es por clase.
alter table public.races
  drop constraint if exists races_regatta_id_race_number_key;
alter table public.races
  add constraint races_regatta_class_id_race_number_key
  unique (regatta_class_id, race_number);

-- Un barco no puede inscribirse dos veces en la misma clase.
alter table public.regatta_entries
  drop constraint if exists regatta_entries_regatta_id_boat_id_key;
alter table public.regatta_entries
  add constraint regatta_entries_regatta_class_id_boat_id_key
  unique (regatta_class_id, boat_id);

-- La clase y los descartes ahora viven en regatta_classes.
alter table public.regattas
  drop column sailing_class,
  drop column discards_count;

comment on column public.regattas.status is
  'Estado paraguas informativo del campeonato. El que manda para '
  'inscripción y resultados es el status de cada regatta_class.';

-- ============================================================
-- 5. Índices
-- ============================================================
create index regatta_classes_regatta_id_idx on public.regatta_classes (regatta_id);
create index races_regatta_class_id_idx on public.races (regatta_class_id);
create index regatta_entries_regatta_class_id_idx on public.regatta_entries (regatta_class_id);

-- ============================================================
-- 6. RLS (mismo criterio que regattas)
-- ============================================================
alter table public.regatta_classes enable row level security;

create policy "regatta_classes_select_public"
  on public.regatta_classes for select using (true);
-- Escritura: solo backend (service role) con permisos admin.

create trigger regatta_classes_set_updated_at
  before update on public.regatta_classes
  for each row execute function public.set_updated_at();
