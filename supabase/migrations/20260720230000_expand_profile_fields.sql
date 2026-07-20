-- Perfil de navegante ampliado: datos náuticos y redes sociales.
-- Todas las columnas son nullable para no romper perfiles existentes.

alter table public.profiles
  -- Datos náuticos
  add column club text,
  add column sailing_class text,
  add column usual_role text,
  add column location text,
  -- Redes sociales / contacto (dato crudo, no URL completa donde aplique)
  add column instagram text,
  add column facebook text,
  add column youtube text,
  add column website text
    check (website is null or website ~ '^https?://');

comment on column public.profiles.club is
  'Club o afiliación (texto libre). Cuando existan cuentas de tipo '
  'club/federation, esto migrará a una relación club_id hacia esas cuentas.';

comment on column public.profiles.sailing_class is
  'Clase/categoría en la que navega (texto libre: puede correr varias).';

comment on column public.profiles.instagram is
  'Handle de Instagram sin @ ni URL; el backend lo normaliza.';
