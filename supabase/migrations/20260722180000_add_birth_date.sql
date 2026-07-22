-- Fecha de nacimiento en el perfil.
--
-- El perfil deja de ser un CV descargable y pasa a ser el lugar donde
-- está todo, así que suma datos personales como este.
--
-- Es dato sensible: se lee con las mismas reglas que el resto del
-- perfil (solo si `public_profile` o si sos el dueño), y el backend
-- devuelve la fecha cruda para que el frontend decida cuánto muestra.

-- Sin `current_date` en el CHECK: no es inmutable y rompería un restore
-- (una fila válida hoy podría fallar al recargarse). El "no futuro" lo
-- valida el backend, que sí puede hacerlo bien.
alter table public.profiles
  add column birth_date date
    check (birth_date is null or birth_date > '1900-01-01');

comment on column public.profiles.birth_date is
  'Fecha de nacimiento. Dato personal: visible solo cuando el perfil lo es.';
