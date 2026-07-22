/**
 * Gamificación comunitaria: horas de mar y logros no competitivos.
 *
 * Montado en /api/users/profile/:id/...
 *   POST   /sailing-hours            — solo el dueño registra una salida
 *   DELETE /sailing-hours/:entryId   — solo el dueño la borra
 *   GET    /sailing-hours             — listado (público si perfil es público)
 *
 * Los community_achievements los genera el backend desde otros
 * triggers (publicar post, aceptar invitación, etc.) — no hay ruta
 * directa de alta por el usuario. Eso es justamente lo que les da
 * valor: el dueño no puede autoproclamarse.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

export const SAILING_HOURS_FIELDS =
  'id, user_id, sailed_date, hours, distance_nm, is_public, sailing_class, boat_id, regatta_id, crew_mates, notes, source, created_at, updated_at';

export const COMMUNITY_ACHIEVEMENT_FIELDS =
  'id, user_id, achievement_type, description, earned_at, created_at';

export const SAILING_SOURCES = [
  'manual',
  'garmin',
  'apple_health',
  'strava',
  'regatta_auto',
] as const;

const MAX_NOTES = 1000;
const MAX_CREW_TEXT = 500;

/** Corta un texto opcional; vacío → null. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/** 403 si el que pide no es el dueño del perfil. */
function assertOwner(
  req: import('express').Request,
  res: import('express').Response
): boolean {
  if (req.user!.id !== req.params.id) {
    res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
    return false;
  }
  return true;
}

// ============================================================
// SAILING HOURS
// ============================================================

/** POST /api/users/profile/:id/sailing-hours */
router.post(
  '/profile/:id/sailing-hours',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const body = req.body ?? {};
    const userId = req.params.id;

    if (!isIsoDate(body.sailed_date)) {
      return res.status(422).json({ error: 'La fecha no es válida (YYYY-MM-DD)' });
    }
    if (body.sailed_date > new Date().toISOString().slice(0, 10)) {
      return res.status(422).json({ error: 'La fecha no puede ser futura' });
    }

    const hours = typeof body.hours === 'number' ? body.hours : Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      return res.status(422).json({ error: 'Las horas deben estar entre 0 y 24' });
    }

    // Millas náuticas: es la métrica que se muestra, pero se puede
    // registrar una salida sin haberlas medido.
    let distanceNm: number | null = null;
    if (body.distance_nm !== undefined && body.distance_nm !== null && body.distance_nm !== '') {
      const parsed = Number(body.distance_nm);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99999.9) {
        return res
          .status(422)
          .json({ error: 'Las millas náuticas deben ser un número entre 0 y 99999,9' });
      }
      distanceNm = Math.round(parsed * 10) / 10;
    }

    const source =
      typeof body.source === 'string' && (SAILING_SOURCES as readonly string[]).includes(body.source)
        ? body.source
        : 'manual';

    if (source !== 'manual' && !isNonEmptyString(body.external_id)) {
      return res
        .status(400)
        .json({ error: 'Las fuentes automáticas requieren un external_id' });
    }
    if (source === 'manual' && body.external_id != null) {
      return res
        .status(422)
        .json({ error: 'Las entradas manuales no deben llevar external_id' });
    }

    const insert: Record<string, unknown> = {
      user_id: userId,
      sailed_date: body.sailed_date,
      hours: Math.round(hours * 10) / 10,
      distance_nm: distanceNm,
      // Las salidas alimentan el feed de la comunidad; se puede optar
      // por no compartir una en particular.
      is_public: body.is_public !== false,
      sailing_class: cleanText(body.sailing_class, 60),
      boat_id: body.boat_id || null,
      regatta_id: body.regatta_id || null,
      crew_mates: cleanText(body.crew_mates, MAX_CREW_TEXT),
      notes: cleanText(body.notes, MAX_NOTES),
      source,
      external_id: source === 'manual' ? null : body.external_id,
    };

    const { data, error } = await supabaseAdmin
      .from('sailing_hours')
      .insert(insert)
      .select(SAILING_HOURS_FIELDS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Esa sesión ya fue registrada (external_id duplicado)' });
      }
      throw error;
    }

    await refreshMilestones(userId);

    return res.status(201).json({ sailing_hours: data, rank: await getRank(userId) });
  })
);

/** DELETE /api/users/profile/:id/sailing-hours/:entryId */
router.delete(
  '/profile/:id/sailing-hours/:entryId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const { data, error } = await supabaseAdmin
      .from('sailing_hours')
      .delete()
      .eq('id', req.params.entryId)
      .eq('user_id', req.params.id)
      .select('id, source')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Salida no encontrada' });

    await refreshMilestones(req.params.id);
    return res.status(204).send();
  })
);

/** GET /api/users/profile/:id/sailing-hours — listado público paginado. */
router.get(
  '/profile/:id/sailing-hours',
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 100)
        : 20;
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

    const { data, error, count } = await supabaseAdmin
      .from('sailing_hours')
      .select(SAILING_HOURS_FIELDS, { count: 'exact' })
      .eq('user_id', req.params.id)
      .order('sailed_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({
      entries: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

// ============================================================
// HELPERS: rango + logros de milestone
// ============================================================

interface SailorRank {
  lifetime_hours: number;
  last_30d_hours: number;
  rank: string;
  maintenance_threshold: number;
  is_active: boolean;
}

async function getRank(userId: string): Promise<SailorRank | null> {
  const { data } = await supabaseAdmin
    .from('sailor_ranks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as SailorRank) ?? null;
}

/**
 * Recalcula los logros milestone para horas totales: 100h, 500h, 2000h.
 * Idempotente: si el logro existe, no se duplica (UNIQUE por tipo+user).
 */
async function refreshMilestones(userId: string) {
  const rank = await getRank(userId);
  if (!rank) return;

  const milestones: Array<{ type: string; description: string; threshold: number }> = [
    { type: '100_hours', description: '100 horas de mar acumuladas', threshold: 100 },
    { type: '500_hours', description: '500 horas de mar acumuladas', threshold: 500 },
    { type: '2000_hours', description: '2000 horas de mar acumuladas', threshold: 2000 },
  ];

  for (const m of milestones) {
    if (rank.lifetime_hours >= m.threshold) {
      await supabaseAdmin
        .from('community_achievements')
        .upsert(
          { user_id: userId, achievement_type: m.type, description: m.description },
          { onConflict: 'user_id,achievement_type', ignoreDuplicates: true }
        );
    }
  }

  // First-sailing-hours para la primera entrada.
  if (rank.lifetime_hours >= 0.1) {
    await supabaseAdmin
      .from('community_achievements')
      .upsert(
        {
          user_id: userId,
          achievement_type: 'first_sailing_hours',
          description: 'Primera salida registrada',
        },
        { onConflict: 'user_id,achievement_type', ignoreDuplicates: true }
      );
  }
}

// ============================================================
// COMMUNITY ACHIEVEMENTS (lectura pública)
// ============================================================

/** GET /api/users/profile/:id/community-achievements */
router.get(
  '/profile/:id/community-achievements',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('community_achievements')
      .select(COMMUNITY_ACHIEVEMENT_FIELDS)
      .eq('user_id', req.params.id)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return res.json({ achievements: data ?? [] });
  })
);

export default router;

export { getRank, refreshMilestones };