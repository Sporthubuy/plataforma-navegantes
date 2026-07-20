-- Fase 2: barcos, tripulaciones, buckets de storage para fotos
-- y formato estricto de username.

-- ============================================================
-- boats
-- ============================================================
create table public.boats (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  sail_number text,
  category text not null check (char_length(category) between 1 and 50),
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boats_owner_id_idx on public.boats (owner_id);

alter table public.boats enable row level security;

create policy "boats_select_public"
  on public.boats for select
  using (true);

create policy "boats_insert_own"
  on public.boats for insert
  with check (auth.uid() = owner_id);

create policy "boats_update_own"
  on public.boats for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "boats_delete_own"
  on public.boats for delete
  using (auth.uid() = owner_id);

create trigger boats_set_updated_at
  before update on public.boats
  for each row execute function public.set_updated_at();

-- ============================================================
-- crew_members
-- ============================================================
create table public.crew_members (
  id uuid primary key default gen_random_uuid(),
  boat_id uuid not null references public.boats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (char_length(role) between 1 and 50),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (boat_id, user_id)
);

create index crew_members_boat_id_idx on public.crew_members (boat_id);
create index crew_members_user_id_idx on public.crew_members (user_id);
create index crew_members_status_idx on public.crew_members (status);

alter table public.crew_members enable row level security;

create policy "crew_members_select_public"
  on public.crew_members for select
  using (true);

-- Solo el dueño del barco puede invitar tripulantes.
create policy "crew_members_insert_boat_owner"
  on public.crew_members for insert
  with check (
    exists (
      select 1 from public.boats
      where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

-- Solo el invitado puede actualizar (aceptar/rechazar la invitación).
create policy "crew_members_update_invitee"
  on public.crew_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Puede borrar el dueño del barco (desinvitar) o el propio
-- tripulante (salirse).
create policy "crew_members_delete_owner_or_self"
  on public.crew_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.boats
      where boats.id = boat_id and boats.owner_id = auth.uid()
    )
  );

-- ============================================================
-- Storage: buckets avatars y boats (lectura pública)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('boats', 'boats', true)
on conflict (id) do nothing;

-- Cualquiera puede leer.
create policy "storage_avatars_boats_read"
  on storage.objects for select
  using (bucket_id in ('avatars', 'boats'));

-- Solo autenticados pueden subir.
create policy "storage_avatars_boats_insert"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'boats')
    and auth.role() = 'authenticated'
  );

-- Solo el dueño del archivo puede actualizarlo o borrarlo.
create policy "storage_avatars_boats_update"
  on storage.objects for update
  using (
    bucket_id in ('avatars', 'boats')
    and owner_id = (select auth.uid()::text)
  )
  with check (
    bucket_id in ('avatars', 'boats')
    and owner_id = (select auth.uid()::text)
  );

create policy "storage_avatars_boats_delete"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'boats')
    and owner_id = (select auth.uid()::text)
  );

-- ============================================================
-- Username: normalizar datos existentes y endurecer el formato
-- a ^[a-z0-9_]{3,20}$ (el @ es solo presentación en el frontend).
-- ============================================================

-- Normaliza: minúsculas, solo [a-z0-9_], máximo 20 caracteres.
-- Si queda demasiado corto usa un fallback con el id; si colisiona
-- con otro username, agrega un sufijo derivado del id.
with candidates as (
  select
    id,
    case
      when char_length(lower(left(regexp_replace(username, '[^A-Za-z0-9_]', '', 'g'), 20))) >= 3
        then lower(left(regexp_replace(username, '[^A-Za-z0-9_]', '', 'g'), 20))
      else 'user_' || left(replace(id::text, '-', ''), 8)
    end as base
  from public.profiles
),
ranked as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as rn
  from candidates
)
update public.profiles p
set username = case
  when r.rn = 1 then r.base
  else left(r.base, 12) || '_' || left(replace(p.id::text, '-', ''), 7)
end
from ranked r
where p.id = r.id
  and p.username is distinct from (
    case
      when r.rn = 1 then r.base
      else left(r.base, 12) || '_' || left(replace(p.id::text, '-', ''), 7)
    end
  );

alter table public.profiles
  drop constraint if exists profiles_username_check;

alter table public.profiles
  add constraint profiles_username_check
  check (username ~ '^[a-z0-9_]{3,20}$');
