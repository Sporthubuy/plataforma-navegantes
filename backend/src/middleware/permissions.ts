import { Request, RequestHandler } from 'express';
import { supabaseAdmin } from '../lib/supabase';

/** Catálogo de permisos válidos del sistema con descripción legible. */
export const PERMISSION_CATALOG: Record<string, string> = {
  'users.view': 'Ver la lista, el detalle y las métricas de usuarios',
  'users.suspend': 'Suspender y reactivar cuentas de usuario',
  'users.delete': 'Eliminar cuentas de usuario',
  'users.grant_permissions': 'Otorgar y revocar permisos de administración',
  'boats.view_all': 'Ver todos los barcos de la plataforma',
  'boats.edit_all': 'Editar y eliminar cualquier barco',
  'boats.create_all': 'Crear barcos a nombre de cualquier usuario',
  'regattas.create': 'Crear regatas',
  'regattas.edit': 'Editar regatas y cambiar su estado',
  'regattas.delete': 'Eliminar regatas',
  'regattas.manage_results': 'Gestionar mangas y cargar resultados',
  'clubs.manage': 'Crear, editar y eliminar clubes del catálogo',
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_CATALOG);

/** Permisos de un usuario (array de strings del catálogo). */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.permission as string);
}

/** Carga (y cachea en el request) los permisos del usuario autenticado. */
async function loadPermissions(req: Request): Promise<string[]> {
  if (!req.permissions) {
    req.permissions = await getUserPermissions(req.user!.id);
  }
  return req.permissions;
}

/**
 * Middleware que exige un permiso del catálogo. Asume que requireAuth
 * ya corrió (hay req.user.id).
 */
export function requirePermission(permission: string): RequestHandler {
  return (req, res, next) => {
    loadPermissions(req)
      .then((permissions) => {
        if (!permissions.includes(permission)) {
          res
            .status(403)
            .json({ error: `No tienes el permiso requerido: ${permission}` });
          return;
        }
        next();
      })
      .catch(next);
  };
}
