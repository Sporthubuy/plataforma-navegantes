-- "En qué te gusta navegar".
--
-- Distinto de `professional_summary.specialties`, que es lo que ofrecés
-- profesionalmente. Esto es identidad: windsurfista, optimista, proa en
-- J/24. Un navegante suele tener varias, así que va en tabla y no en un
-- campo suelto del perfil.
--
-- `role` es opcional: "Windsurf" se sostiene solo, pero "Proa" sin clase
-- no dice nada, por eso la clase es obligatoria.

create table public.sailing_interests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  sailing_class text not null check (char_length(sailing_class) between 1 and 60),
  -- Rol a bordo en esa clase: Proa, Timonel, Táctico…
  role          text check (role is null or char_length(role) between 1 and 50),
  created_at    timestamptz not null default now(),
  -- La misma combinación no se repite.
  unique (user_id, sailing_class, role)
);

create index sailing_interests_user_idx on public.sailing_interests (user_id);
-- Para "quién navega en Optimist", que es la búsqueda natural.
create index sailing_interests_class_idx on public.sailing_interests (sailing_class);

alter table public.sailing_interests enable row level security;

create policy "interests_select_visible"
  on public.sailing_interests for select
  using (public.profile_is_visible(user_id));

create policy "interests_write_own"
  on public.sailing_interests for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.sailing_interests is
  'En qué le gusta navegar a cada quien. Identidad, no oferta profesional.';
