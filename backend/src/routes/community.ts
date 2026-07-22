/**
 * Comunidad: seguimiento, cargos náuticos y el feed de salidas.
 *
 * Es lo que reemplaza al bloque competitivo del perfil. La idea: lo que
 * hacés se comparte en el inicio y suma millas; el legajo (regatas,
 * credenciales) queda aparte y no se mezcla.
 */

import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const PUBLIC_PROFILE =
  'id, username, name, avatar_url, verified_badge, country, city';

const STATS_FIELDS =
  'user_id, followers_count, following_count, outings_count, total_nm, total_hours, last_sailed_date';

const ACTIVITY_FIELDS =
  'id, user_id, sailed_date, hours, distance_nm, sailing_class, notes, crew_mates, boat_id, regatta_id, source, is_public, created_at';

/** User id si viene un Bearer válido; null si la lectura es anónima. */
function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(header.slice(7).trim(), config.jwtSecret) as {
      sub?: string;
    };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function pagination(query: Record<string, unknown>) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  return {
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT,
    offset: Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0,
  };
}

// ============================================================
// SEGUIMIENTO
// ============================================================

/** POST /api/community/follow/:id — seguir. Idempotente. */
router.post(
  '/follow/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user!.id;
    const target = req.params.id;

    if (me === target) {
      return res.status(422).json({ error: 'No podés seguirte a vos mismo' });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, status')
      .eq('id', target)
      .maybeSingle();

    if (!profile) return res.status(404).json({ error: 'Ese navegante no existe' });
    if (profile.status !== 'active') {
      return res.status(422).json({ error: 'Esa cuenta no está activa' });
    }

    const { error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: me, following_id: target });

    // Ya lo seguía: el resultado buscado igual se cumple.
    if (error && error.code !== '23505') throw error;

    return res.status(201).json({ following: true });
  })
);

/** DELETE /api/community/follow/:id — dejar de seguir. */
router.delete(
  '/follow/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin
      .from('follows')
      .delete()
      .eq('follower_id', req.user!.id)
      .eq('following_id', req.params.id);

    if (error) throw error;
    return res.json({ following: false });
  })
);

/**
 * GET /api/community/:id/followers y /:id/following — público.
 * `type` decide de qué lado se mira la relación.
 */
for (const [path, column, otherColumn] of [
  ['/:id/followers', 'following_id', 'follower_id'],
  ['/:id/following', 'follower_id', 'following_id'],
] as const) {
  router.get(
    path,
    asyncHandler(async (req, res) => {
      const { limit, offset } = pagination(req.query);

      const { data, error, count } = await supabaseAdmin
        .from('follows')
        .select(otherColumn, { count: 'exact' })
        .eq(column, req.params.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const ids = (data ?? []).map(
        (row) => (row as Record<string, string>)[otherColumn]
      );
      if (ids.length === 0) {
        return res.json({ users: [], pagination: { limit, offset, total: 0 } });
      }

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select(PUBLIC_PROFILE)
        .in('id', ids);

      return res.json({
        users: profiles ?? [],
        pagination: { limit, offset, total: count ?? 0 },
      });
    })
  );
}

/** GET /api/community/:id/stats — números de comunidad + si lo sigo. */
router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('community_stats')
      .select(STATS_FIELDS)
      .eq('user_id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Perfil no encontrado' });

    return res.json({ stats: data });
  })
);

/** GET /api/community/following-state/:id — requiere auth. ¿Lo sigo? */
router.get(
  '/following-state/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('follower_id', req.user!.id)
      .eq('following_id', req.params.id)
      .maybeSingle();

    return res.json({ following: Boolean(data) });
  })
);

// ============================================================
// FEED DE SALIDAS
// ============================================================

/**
 * GET /api/community/activities — las salidas de la comunidad.
 * `?scope=following` limita a quienes sigo; por defecto se ve a todos,
 * que es lo que hace que un navegante nuevo no vea el inicio vacío.
 */
router.get(
  '/activities',
  asyncHandler(async (req, res) => {
    const { limit, offset } = pagination(req.query);
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'all';
    const userId = typeof req.query.user_id === 'string' ? req.query.user_id : '';

    let query = supabaseAdmin
      .from('sailing_hours')
      .select(ACTIVITY_FIELDS, { count: 'exact' })
      .eq('is_public', true);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (scope === 'following') {
      // Sin auth no hay a quién seguir: se cae a ver todo.
      const me = optionalUserId(req);
      if (me) {
        const { data: following } = await supabaseAdmin
          .from('follows')
          .select('following_id')
          .eq('follower_id', me);
        const ids = (following ?? []).map((f) => f.following_id);
        // Las propias también entran: uno quiere verse en su feed.
        query = query.in('user_id', [...ids, me]);
      }
    }

    const { data, error, count } = await query
      .order('sailed_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const activities = data ?? [];
    if (activities.length === 0) {
      return res.json({ activities: [], pagination: { limit, offset, total: 0 } });
    }

    const [{ data: profiles }, { data: boats }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select(PUBLIC_PROFILE)
        .in('id', [...new Set(activities.map((a) => a.user_id))]),
      supabaseAdmin
        .from('boats')
        .select('id, name, category')
        .in(
          'id',
          activities.map((a) => a.boat_id).filter((id): id is string => Boolean(id))
        ),
    ]);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const boatById = new Map((boats ?? []).map((b) => [b.id, b]));

    return res.json({
      activities: activities.map((a) => ({
        ...a,
        user: profileById.get(a.user_id) ?? null,
        boat: a.boat_id ? (boatById.get(a.boat_id) ?? null) : null,
      })),
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

// ============================================================
// CARGOS NÁUTICOS
// ============================================================

const POSITION_FIELDS =
  'id, user_id, title, club_id, organization, start_date, end_date, is_current, created_at';

/** GET /api/community/:id/positions — público. */
router.get(
  '/:id/positions',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('nautical_positions')
      .select(`${POSITION_FIELDS}, club:clubs(id, name, short_name)`)
      .eq('user_id', req.params.id)
      .order('is_current', { ascending: false })
      .order('start_date', { ascending: false, nullsFirst: false });

    if (error) throw error;
    return res.json({ positions: data ?? [] });
  })
);

/** POST /api/community/:id/positions — solo el dueño. */
router.post(
  '/:id/positions',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.id !== req.params.id) {
      return res.status(403).json({ error: 'Solo podés editar tu propio perfil' });
    }

    const body = req.body ?? {};
    if (!isNonEmptyString(body.title)) {
      return res.status(400).json({ error: 'El cargo es obligatorio' });
    }

    const isCurrent = body.is_current === true;
    const endDate = isCurrent ? null : body.end_date || null;

    if (body.start_date && endDate && endDate < body.start_date) {
      return res
        .status(422)
        .json({ error: 'La fecha de fin no puede ser anterior a la de inicio' });
    }

    const { data, error } = await supabaseAdmin
      .from('nautical_positions')
      .insert({
        user_id: req.params.id,
        title: body.title.trim().slice(0, 100),
        club_id: isNonEmptyString(body.club_id) ? body.club_id : null,
        organization: isNonEmptyString(body.organization)
          ? body.organization.trim().slice(0, 150)
          : null,
        start_date: body.start_date || null,
        end_date: endDate,
        is_current: isCurrent,
      })
      .select(POSITION_FIELDS)
      .single();

    if (error) throw error;
    return res.status(201).json({ position: data });
  })
);

/** DELETE /api/community/:id/positions/:positionId — solo el dueño. */
router.delete(
  '/:id/positions/:positionId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.id !== req.params.id) {
      return res.status(403).json({ error: 'Solo podés editar tu propio perfil' });
    }

    const { data, error } = await supabaseAdmin
      .from('nautical_positions')
      .delete()
      .eq('id', req.params.positionId)
      .eq('user_id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Cargo no encontrado' });
    return res.status(204).send();
  })
);

// ============================================================
// EN QUÉ LE GUSTA NAVEGAR
// ============================================================

const INTEREST_FIELDS = 'id, user_id, sailing_class, role, created_at';

/** GET /api/community/:id/interests — público. */
router.get(
  '/:id/interests',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('sailing_interests')
      .select(INTEREST_FIELDS)
      .eq('user_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({ interests: data ?? [] });
  })
);

/** POST /api/community/:id/interests — solo el dueño. */
router.post(
  '/:id/interests',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.id !== req.params.id) {
      return res.status(403).json({ error: 'Solo podés editar tu propio perfil' });
    }

    const body = req.body ?? {};
    if (!isNonEmptyString(body.sailing_class)) {
      return res.status(400).json({ error: 'La clase es obligatoria' });
    }

    const { data, error } = await supabaseAdmin
      .from('sailing_interests')
      .insert({
        user_id: req.params.id,
        sailing_class: body.sailing_class.trim().slice(0, 60),
        role: isNonEmptyString(body.role) ? body.role.trim().slice(0, 50) : null,
      })
      .select(INTEREST_FIELDS)
      .single();

    // Ya la tenía cargada: no es un error que valga la pena mostrar.
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya tenés esa combinación' });
    }
    if (error) throw error;
    return res.status(201).json({ interest: data });
  })
);

/** DELETE /api/community/:id/interests/:interestId — solo el dueño. */
router.delete(
  '/:id/interests/:interestId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.id !== req.params.id) {
      return res.status(403).json({ error: 'Solo podés editar tu propio perfil' });
    }

    const { data, error } = await supabaseAdmin
      .from('sailing_interests')
      .delete()
      .eq('id', req.params.interestId)
      .eq('user_id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    return res.status(204).send();
  })
);

export default router;
