-- Permisos nuevos para el panel de administración completo.
--
--   content.moderate — borrar posts, comentarios, clasificados y salidas
--                      de cualquier usuario (moderación).
--   users.edit_all   — editar el perfil de cualquier usuario, no solo
--                      suspenderlo.
--
-- `users.verify` ya existía (verificación de credenciales y perfiles).

alter table public.user_permissions
  drop constraint if exists user_permissions_permission_check;

alter table public.user_permissions
  add constraint user_permissions_permission_check check (
    permission in (
      'users.view',
      'users.suspend',
      'users.delete',
      'users.grant_permissions',
      'users.verify',
      'users.edit_all',
      'boats.view_all',
      'boats.edit_all',
      'boats.create_all',
      'regattas.create',
      'regattas.edit',
      'regattas.delete',
      'regattas.manage_results',
      'clubs.manage',
      'content.moderate'
    )
  );
