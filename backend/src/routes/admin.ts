import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString, isValidUsername } from '../lib/validation';
import { normalizeUsername } from './users';
import { sanitizeProfileExtras } from '../lib/profile-fields';
import { sanitizeLocation } from '../lib/location';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATALOG,
  getUserPermissions,
  requirePermission,
} from '../middleware/permissions';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ADMIN_PERMISSION = 'users.grant_permissions';

const BOAT_WITH_OWNER =
  'id, name, sail_number, category, photo_url, owner_id, created_at, updated_at, owner:profiles(id, username, name, avatar_url)';

/** ¿El usuario tiene permisos de administración (grant_permissions)? */
async function isAdmin(userId: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(ADMIN_PERMISSION);
}

/** Trae el email de auth de un usuario (o null). */
async function getAuthEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return data?.user?.email ?? null;
}

function parsePagination(query: Record<string, unknown>) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

// ============================================================
// USUARIOS
// ============================================================

/**
 * GET /api/admin/users — requiere 'users.view'.
 * Lista paginada con filtros y contador de barcos como owner.
 */
router.get(
  '/users',
  requireAuth,
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status =
      typeof req.query.status === 'string' ? req.query.status : '';
    const accountType =
      typeof req.query.account_type === 'string' ? req.query.account_type : '';
    const sortBy =
      req.query.sort === 'last_active_at' ? 'last_active_at' : 'created_at';

    let query = supabaseAdmin
      .from('profiles')
      .select(
        'id, username, name, avatar_url, account_type, status, created_at, last_active_at',
        { count: 'exact' }
      );

    if (search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`);
      query = query.ilike('username', `%${escaped}%`);
    }
    if (status === 'active' || status === 'suspended') {
      query = query.eq('status', status);
    }
    if (['sailor', 'club', 'federation'].includes(accountType)) {
      query = query.eq('account_type', accountType);
    }

    const { data, error, count } = await query
      .order(sortBy, { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const rows = data ?? [];
    const ids = rows.map((r) => r.id);

    // Contador de barcos por owner (una sola consulta).
    const boatCounts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: boats } = await supabaseAdmin
        .from('boats')
        .select('owner_id')
        .in('owner_id', ids);
      for (const b of boats ?? []) {
        boatCounts.set(b.owner_id, (boatCounts.get(b.owner_id) ?? 0) + 1);
      }
    }

    // Email desde auth para cada usuario listado.
    const emails = await Promise.all(
      rows.map((r) => getAuthEmail(r.id).catch(() => null))
    );

    const users = rows.map((r, i) => ({
      ...r,
      email: emails[i],
      boats_count: boatCounts.get(r.id) ?? 0,
    }));

    return res.json({
      users,
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/**
 * GET /api/admin/users/:id — requiere 'users.view'.
 * Detalle completo: perfil, email, barcos, permisos, estado de suspensión.
 */
router.get(
  '/users/:id',
  requireAuth,
  requirePermission('users.view'),
  asyncHandler(async (req, res) => {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, username, name, bio, avatar_url, account_type, status, suspended_at, suspended_reason, created_at, last_active_at, verified_badge, public_profile, sailing_class, usual_role, country, city, club_id'
      )
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const [email, boats, permissions] = await Promise.all([
      getAuthEmail(profile.id).catch(() => null),
      supabaseAdmin
        .from('boats')
        .select('id, name, sail_number, category, photo_url, created_at')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false }),
      getUserPermissions(profile.id),
    ]);

    return res.json({
      user: {
        ...profile,
        email,
        boats: boats.data ?? [],
        permissions,
      },
    });
  })
);

/**
 * PUT /api/admin/users/:id/suspend — requiere 'users.suspend'.
 */
router.put(
  '/users/:id/suspend',
  requireAuth,
  requirePermission('users.suspend'),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const { reason } = req.body ?? {};

    if (targetId === req.user!.id) {
      return res.status(422).json({ error: 'No puedes suspenderte a ti mismo' });
    }

    const { data: target, error } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('id', targetId)
      .maybeSingle();

    if (error) throw error;
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (await isAdmin(targetId)) {
      return res
        .status(422)
        .json({ error: 'No puedes suspender a otro administrador' });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspended_reason: isNonEmptyString(reason) ? reason.trim() : null,
      })
      .eq('id', targetId)
      .select('id, username, status, suspended_at, suspended_reason')
      .single();

    if (updateError) throw updateError;
    return res.json({ user: data });
  })
);

/**
 * PUT /api/admin/users/:id/reactivate — requiere 'users.suspend'.
 */
router.put(
  '/users/:id/reactivate',
  requireAuth,
  requirePermission('users.suspend'),
  asyncHandler(async (req, res) => {
    const { data: target, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        status: 'active',
        suspended_at: null,
        suspended_reason: null,
      })
      .eq('id', req.params.id)
      .select('id, username, status')
      .single();

    if (updateError) throw updateError;
    return res.json({ user: data });
  })
);

/**
 * DELETE /api/admin/users/:id — requiere 'users.delete'.
 * Borra de Supabase Auth; el profile y todo lo demás cae por CASCADE.
 */
router.delete(
  '/users/:id',
  requireAuth,
  requirePermission('users.delete'),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;

    if (targetId === req.user!.id) {
      return res.status(422).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();

    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (await isAdmin(targetId)) {
      return res
        .status(422)
        .json({ error: 'No puedes eliminar a otro administrador' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (error) throw error;

    return res.status(204).send();
  })
);

// ============================================================
// PERMISOS
// ============================================================

/**
 * GET /api/admin/permissions/catalog — requiere 'users.grant_permissions'.
 */
router.get(
  '/permissions/catalog',
  requireAuth,
  requirePermission(ADMIN_PERMISSION),
  asyncHandler(async (_req, res) => {
    const catalog = ALL_PERMISSIONS.map((permission) => ({
      permission,
      description: PERMISSION_CATALOG[permission],
    }));
    return res.json({ catalog });
  })
);

/**
 * GET /api/admin/users/:id/permissions — requiere 'users.grant_permissions'.
 */
router.get(
  '/users/:id/permissions',
  requireAuth,
  requirePermission(ADMIN_PERMISSION),
  asyncHandler(async (req, res) => {
    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const permissions = await getUserPermissions(req.params.id);
    return res.json({ permissions });
  })
);

/**
 * POST /api/admin/users/:id/permissions — requiere 'users.grant_permissions'.
 * Body { permission }. 409 si ya lo tiene, 422 si no está en el catálogo.
 */
router.post(
  '/users/:id/permissions',
  requireAuth,
  requirePermission(ADMIN_PERMISSION),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const { permission } = req.body ?? {};

    if (!isNonEmptyString(permission) || !ALL_PERMISSIONS.includes(permission)) {
      return res
        .status(422)
        .json({ error: 'El permiso no existe en el catálogo del sistema' });
    }

    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', targetId)
      .maybeSingle();
    if (!target) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .insert({
        user_id: targetId,
        permission,
        granted_by: req.user!.id,
      })
      .select('id, permission, granted_by, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ error: 'El usuario ya tiene ese permiso' });
      }
      throw error;
    }

    return res.status(201).json({ permission: data });
  })
);

/**
 * DELETE /api/admin/users/:id/permissions/:permission —
 * requiere 'users.grant_permissions'. No permite auto-revocarse
 * 'users.grant_permissions' (para no quedar sin admins).
 */
router.delete(
  '/users/:id/permissions/:permission',
  requireAuth,
  requirePermission(ADMIN_PERMISSION),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const permission = req.params.permission;

    if (targetId === req.user!.id && permission === ADMIN_PERMISSION) {
      return res.status(422).json({
        error:
          'No puedes revocarte a ti mismo el permiso para otorgar permisos',
      });
    }

    const { error } = await supabaseAdmin
      .from('user_permissions')
      .delete()
      .eq('user_id', targetId)
      .eq('permission', permission);

    if (error) throw error;
    return res.status(204).send();
  })
);

// ============================================================
// DASHBOARD / MÉTRICAS
// ============================================================

/**
 * GET /api/admin/stats — requiere 'users.view'.
 */
router.get(
  '/stats',
  requireAuth,
  requirePermission('users.view'),
  asyncHandler(async (_req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startIso = startOfDay.toISOString();

    // Altas de la última semana, para el pulso de crecimiento.
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekIso = weekAgo.toISOString();

    const headCount = (table: string) =>
      supabaseAdmin.from(table).select('id', { count: 'exact', head: true });

    const [
      totalUsers,
      activeToday,
      newToday,
      newThisWeek,
      totalBoats,
      totalPosts,
      totalClubs,
      totalOutings,
      allProfiles,
      activeClassifieds,
      liveRegattas,
      milesRows,
    ] = await Promise.all([
      headCount('profiles'),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('last_active_at', startIso),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startIso),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', weekIso),
      headCount('boats'),
      headCount('posts'),
      headCount('clubs'),
      headCount('sailing_hours'),
      supabaseAdmin.from('profiles').select('account_type, status'),
      supabaseAdmin
        .from('classifieds')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabaseAdmin
        .from('regattas')
        .select('id', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']),
      // Millas totales: se suman en memoria (no hay agregado barato en
      // el cliente de Supabase), pero son pocas filas.
      supabaseAdmin.from('sailing_hours').select('distance_nm'),
    ]);

    const byAccountType: Record<string, number> = {
      sailor: 0,
      club: 0,
      federation: 0,
    };
    const byStatus: Record<string, number> = { active: 0, suspended: 0 };
    for (const p of allProfiles.data ?? []) {
      byAccountType[p.account_type] = (byAccountType[p.account_type] ?? 0) + 1;
      byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    }

    const totalMiles = (milesRows.data ?? []).reduce(
      (sum, r) => sum + (Number(r.distance_nm) || 0),
      0
    );

    return res.json({
      total_users: totalUsers.count ?? 0,
      active_today: activeToday.count ?? 0,
      new_today: newToday.count ?? 0,
      new_this_week: newThisWeek.count ?? 0,
      total_boats: totalBoats.count ?? 0,
      total_posts: totalPosts.count ?? 0,
      total_clubs: totalClubs.count ?? 0,
      total_outings: totalOutings.count ?? 0,
      total_miles: Math.round(totalMiles * 10) / 10,
      active_classifieds: activeClassifieds.count ?? 0,
      live_regattas: liveRegattas.count ?? 0,
      by_account_type: byAccountType,
      by_status: byStatus,
    });
  })
);

// ============================================================
// BARCOS (admin) — saltan el chequeo de ownership
// ============================================================

/**
 * GET /api/admin/boats — requiere 'boats.view_all'.
 */
router.get(
  '/boats',
  requireAuth,
  requirePermission('boats.view_all'),
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let query = supabaseAdmin
      .from('boats')
      .select(BOAT_WITH_OWNER, { count: 'exact' });

    if (search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`);
      query = query.ilike('name', `%${escaped}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({
      boats: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/**
 * POST /api/admin/boats — requiere 'boats.create_all'.
 * Crea un barco a nombre de cualquier owner_id.
 */
router.post(
  '/boats',
  requireAuth,
  requirePermission('boats.create_all'),
  asyncHandler(async (req, res) => {
    const { owner_id, name, sail_number, category, photo_url } = req.body ?? {};

    if (!isNonEmptyString(owner_id)) {
      return res.status(400).json({ error: 'owner_id es obligatorio' });
    }
    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'El nombre del barco es obligatorio' });
    }
    if (!isNonEmptyString(category)) {
      return res.status(400).json({ error: 'La categoría es obligatoria' });
    }

    const { data: owner } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', owner_id)
      .maybeSingle();
    if (!owner) {
      return res.status(422).json({ error: 'El owner_id no corresponde a un usuario' });
    }

    const { data, error } = await supabaseAdmin
      .from('boats')
      .insert({
        owner_id,
        name: name.trim(),
        category: category.trim(),
        sail_number: isNonEmptyString(sail_number) ? sail_number.trim() : null,
        photo_url: isNonEmptyString(photo_url) ? photo_url : null,
      })
      .select(BOAT_WITH_OWNER)
      .single();

    if (error) throw error;
    return res.status(201).json({ boat: data });
  })
);

/**
 * PUT /api/admin/boats/:id — requiere 'boats.edit_all'.
 */
router.put(
  '/boats/:id',
  requireAuth,
  requirePermission('boats.edit_all'),
  asyncHandler(async (req, res) => {
    const { data: boat } = await supabaseAdmin
      .from('boats')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!boat) {
      return res.status(404).json({ error: 'Barco no encontrado' });
    }

    const { name, sail_number, category, photo_url } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      updates.name = name.trim();
    }
    if (category !== undefined) {
      if (!isNonEmptyString(category)) {
        return res.status(400).json({ error: 'La categoría no puede estar vacía' });
      }
      updates.category = category.trim();
    }
    if (sail_number !== undefined) {
      updates.sail_number = isNonEmptyString(sail_number)
        ? sail_number.trim()
        : null;
    }
    if (photo_url !== undefined) {
      updates.photo_url = isNonEmptyString(photo_url) ? photo_url : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('boats')
      .update(updates)
      .eq('id', req.params.id)
      .select(BOAT_WITH_OWNER)
      .single();

    if (error) throw error;
    return res.json({ boat: data });
  })
);

/**
 * DELETE /api/admin/boats/:id — requiere 'boats.edit_all'.
 */
router.delete(
  '/boats/:id',
  requireAuth,
  requirePermission('boats.edit_all'),
  asyncHandler(async (req, res) => {
    const { data: boat } = await supabaseAdmin
      .from('boats')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!boat) {
      return res.status(404).json({ error: 'Barco no encontrado' });
    }

    const { error } = await supabaseAdmin
      .from('boats')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;

    return res.status(204).send();
  })
);

/** POST /api/admin/classifieds/expire — requiere permiso de administración. */
router.post(
  '/classifieds/expire',
  requireAuth,
  requirePermission('users.grant_permissions'),
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabaseAdmin.rpc('expire_classifieds');
    if (error) throw error;
    return res.json({ expired_count: data ?? 0 });
  })
);

// ============================================================
// VERIFICACIÓN DE PERFILES
// ============================================================

/**
 * PUT /api/admin/users/:id/verified — da o quita el sello de verificado.
 * Requiere 'users.verify', el mismo permiso que verifica credenciales.
 */
router.put(
  '/users/:id/verified',
  requireAuth,
  requirePermission('users.verify'),
  asyncHandler(async (req, res) => {
    const { verified } = req.body ?? {};
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'verified debe ser booleano' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ verified_badge: verified })
      .eq('id', req.params.id)
      .select('id, verified_badge')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ profile: data });
  })
);

/**
 * GET /api/admin/credentials/pending — credenciales sin verificar,
 * para tener una cola de revisión en un solo lugar.
 */
router.get(
  '/credentials/pending',
  requireAuth,
  requirePermission('users.verify'),
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const { data, error, count } = await supabaseAdmin
      .from('credentials')
      .select(
        'id, user_id, credential_type, title, issuer, issue_date, credential_url, created_at, user:profiles(id, username, name, avatar_url)',
        { count: 'exact' }
      )
      .eq('is_verified', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({
      credentials: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

// ============================================================
// EDICIÓN DE PERFIL (admin) — cualquier usuario
// ============================================================

/**
 * PUT /api/admin/users/:id/profile — edita el perfil de cualquiera.
 * Requiere 'users.edit_all'. Reutiliza los mismos sanitizadores que el
 * PUT del dueño, así la validación es idéntica desde los dos lados.
 */
router.put(
  '/users/:id/profile',
  requireAuth,
  requirePermission('users.edit_all'),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (body.username !== undefined) {
      const normalized = normalizeUsername(String(body.username));
      if (!isValidUsername(normalized)) {
        return res.status(422).json({
          error:
            'Username inválido: 3-20 caracteres, minúsculas, números y guion bajo',
        });
      }
      const { data: taken } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .neq('id', targetId)
        .maybeSingle();
      if (taken) {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      updates.username = normalized;
    }

    if (body.name !== undefined) updates.name = body.name;
    if (body.bio !== undefined) updates.bio = body.bio;
    if (body.verified_badge !== undefined) {
      updates.verified_badge = body.verified_badge === true;
    }
    if (body.public_profile !== undefined) {
      updates.public_profile = body.public_profile === true;
    }

    const extras = sanitizeProfileExtras(body);
    if ('error' in extras) {
      return res.status(extras.error.status).json({ error: extras.error.message });
    }
    Object.assign(updates, extras.updates);

    const location = await sanitizeLocation(body, { withClub: true });
    if ('error' in location) {
      return res
        .status(location.error.status)
        .json({ error: location.error.message });
    }
    Object.assign(updates, location.updates);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', targetId)
      .select('id, username, name, bio, verified_badge, public_profile')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json({ profile: data });
  })
);

export default router;
