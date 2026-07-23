-- Kudos a las salidas.
--
-- Las salidas son el contenido central del feed pero no se podían
-- responder de ninguna forma: publicabas que navegaste y ahí moría.
-- Un aplauso de un toque es la reacción que corresponde a una
-- actividad registrada (el modelo de Strava), y es lo que sostiene que
-- la gente siga publicando.

create table public.activity_kudos (
  activity_id uuid not null references public.sailing_hours (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- Uno por persona y salida: el toggle es idempotente por diseño.
  primary key (activity_id, user_id)
);

create index activity_kudos_activity_idx on public.activity_kudos (activity_id);
create index activity_kudos_user_idx on public.activity_kudos (user_id);

alter table public.activity_kudos enable row level security;

-- Quién aplaudió es público: ver que a otros les gustó es parte de la
-- señal social.
create policy "kudos_select_public"
  on public.activity_kudos for select
  using (true);

create policy "kudos_insert_own"
  on public.activity_kudos for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "kudos_delete_own"
  on public.activity_kudos for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.activity_kudos is
  'Aplausos a una salida. Uno por persona; la PK compuesta lo garantiza.';
