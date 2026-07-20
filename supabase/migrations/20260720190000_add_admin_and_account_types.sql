-- Fase 3: tipos de cuenta, suspensión, permisos granulares y actividad.

-- ============================================================
-- profiles: tipo de cuenta, estado y actividad
-- ============================================================
alter table public.profiles
  add column account_type text not null default 'sailor'
    check (account_type in ('sailor', 'club', 'federation')),
  add column status text not null default 'active'
    check (status in ('active', 'suspended')),
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column last_active_at timestamptz;

-- Nota: la policy de lectura pública de profiles queda como está —
-- un usuario suspendido sigue siendo legible; el bloqueo real lo
-- hace el backend en cada request autenticado.

-- ============================================================
-- user_permissions: permisos granulares
-- ============================================================
create table public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null check (
    permission in (
      'users.view',
      'users.suspend',
      'users.delete',
      'users.grant_permissions',
      'boats.view_all',
      'boats.edit_all',
      'boats.create_all'
    )
  ),
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, permission)
);

create index user_permissions_user_id_idx on public.user_permissions (user_id);

alter table public.user_permissions enable row level security;

-- Helper security definer para evitar recursión de RLS al consultar
-- user_permissions dentro de su propia policy.
create function public.has_permission(uid uuid, perm text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_permissions
    where user_id = uid and permission = perm
  );
$$;

-- Lectura: el propio usuario o quien pueda otorgar permisos.
create policy "user_permissions_select_own_or_admin"
  on public.user_permissions for select
  using (
    auth.uid() = user_id
    or public.has_permission(auth.uid(), 'users.grant_permissions')
  );

-- Sin policies de insert/update/delete: los clientes no pueden
-- escribir esta tabla; solo el backend con la service role key.
