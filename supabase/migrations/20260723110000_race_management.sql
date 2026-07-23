-- Gestión de mangas: anular sin borrar, y nombrarlas/fecharlas.
--
-- El RRS permite ANULAR una manga navegada (por ejemplo si la salida
-- fue mala o el recorrido quedó inválido). Borrarla pierde el registro
-- de que existió y renumera todo lo demás; anularla la deja visible
-- pero fuera del puntaje.

alter table public.races
  drop constraint if exists races_status_check;

alter table public.races
  add constraint races_status_check check (
    status in ('scheduled', 'completed', 'abandoned')
  );

-- Motivo de la anulación, para que quede asentado en el acta.
alter table public.races
  add column abandoned_reason text
    check (abandoned_reason is null or char_length(abandoned_reason) between 1 and 300);

comment on column public.races.status is
  'scheduled = programada, completed = navegada y puntuada, abandoned = anulada (no puntúa).';
