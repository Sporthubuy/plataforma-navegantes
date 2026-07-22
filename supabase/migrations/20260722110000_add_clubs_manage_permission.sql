-- Permiso `clubs.manage`: quién puede administrar el catálogo de clubes.
-- Hoy lo tiene solo el administrador; el modelo de permisos granulares
-- ya permite delegarlo a otro usuario sin tocar código.

alter table public.user_permissions
  drop constraint if exists user_permissions_permission_check;

alter table public.user_permissions
  add constraint user_permissions_permission_check check (
    permission in (
      'users.view',
      'users.suspend',
      'users.delete',
      'users.grant_permissions',
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
