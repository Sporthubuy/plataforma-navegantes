/**
 * CV náutico: resumen profesional, credenciales y logros.
 *
 * Se monta bajo /api/users para que las rutas queden como
 * /api/users/profile/:id/credentials, junto al resto del perfil.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

export const CREDENTIAL_TYPES = [
  'instructor',
  'coach',
  'sailor_level',
  'experience',
  'other',
] as const;

export const MANUAL_ACHIEVEMENT_TYPES = [
  '1st_place',
  '2nd_place',
  '3rd_place',
  'podium',
  'best_class',
  'regatta_finished',
] as const;

export const CREDENTIAL_FIELDS =
  'id, user_id, credential_type, title, issuer, issue_date, expiry_date, credential_url, is_verified, created_at, updated_at';

export const ACHIEVEMENT_FIELDS =
  'id, user_id, achievement_type, regatta_id, regatta_class_id, regatta_name, regatta_class, regatta_date, position, total_entries, boat_name, is_manual, notes, created_at';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/** Corta y limpia un texto opcional; vacío → null. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Valida una fecha ISO (YYYY-MM-DD). */
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
// CREDENCIALES
// ============================================================

/** POST /api/users/profile/:id/credentials — solo el dueño. */
router.post(
  '/profile/:id/credentials',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const body = req.body ?? {};

    if (!(CREDENTIAL_TYPES as readonly string[]).includes(body.credential_type)) {
      return res.status(422).json({ error: 'Tipo de credencial inválido' });
    }
    if (!isNonEmptyString(body.title)) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    for (const field of ['issue_date', 'expiry_date'] as const) {
      if (body[field] && !isIsoDate(body[field])) {
        return res.status(422).json({ error: `La fecha ${field} no es válida` });
      }
    }
    if (
      body.issue_date &&
      body.expiry_date &&
      body.expiry_date < body.issue_date
    ) {
      return res
        .status(422)
        .json({ error: 'El vencimiento no puede ser anterior a la emisión' });
    }
    const url = cleanText(body.credential_url, 500);
    if (url && !/^https?:\/\//i.test(url)) {
      return res
        .status(422)
        .json({ error: 'El link debe empezar con http:// o https://' });
    }

    const { data, error } = await supabaseAdmin
      .from('credentials')
      .insert({
        user_id: req.params.id,
        credential_type: body.credential_type,
        title: body.title.trim().slice(0, 150),
        issuer: cleanText(body.issuer, 150),
        issue_date: body.issue_date || null,
        expiry_date: body.expiry_date || null,
        credential_url: url,
        // Verificar es potestad de un admin, nunca del propio usuario.
        is_verified: false,
      })
      .select(CREDENTIAL_FIELDS)
      .single();

    if (error) throw error;
    return res.status(201).json({ credential: data });
  })
);

/**
 * PUT /api/users/profile/:id/credentials/:credentialId — verificar.
 * Requiere el permiso users.verify: el dueño no puede autoverificarse,
 * que es justamente lo que le da valor al sello.
 */
router.put(
  '/profile/:id/credentials/:credentialId',
  requireAuth,
  requirePermission('users.verify'),
  asyncHandler(async (req, res) => {
    const { is_verified } = req.body ?? {};
    if (typeof is_verified !== 'boolean') {
      return res.status(400).json({ error: 'is_verified debe ser booleano' });
    }

    const { data, error } = await supabaseAdmin
      .from('credentials')
      .update({ is_verified })
      .eq('id', req.params.credentialId)
      .eq('user_id', req.params.id)
      .select(CREDENTIAL_FIELDS)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Credencial no encontrada' });
    return res.json({ credential: data });
  })
);

/** DELETE /api/users/profile/:id/credentials/:credentialId — solo el dueño. */
router.delete(
  '/profile/:id/credentials/:credentialId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const { data, error } = await supabaseAdmin
      .from('credentials')
      .delete()
      .eq('id', req.params.credentialId)
      .eq('user_id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Credencial no encontrada' });
    return res.status(204).send();
  })
);

// ============================================================
// LOGROS
// ============================================================

/**
 * GET /api/users/profile/:id/achievements — público.
 * Paginado, más reciente primero. Filtro opcional por tipo.
 */
router.get(
  '/profile/:id/achievements',
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

    let query = supabaseAdmin
      .from('regatta_achievements')
      .select(ACHIEVEMENT_FIELDS, { count: 'exact' })
      .eq('user_id', req.params.id);

    const type = typeof req.query.type === 'string' ? req.query.type : '';
    if ((MANUAL_ACHIEVEMENT_TYPES as readonly string[]).includes(type)) {
      query = query.eq('achievement_type', type);
    }

    const { data, error, count } = await query
      .order('regatta_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({
      achievements: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/**
 * POST /api/users/profile/:id/achievements/manual — solo el dueño.
 * Historial anterior a la app: lo declara el navegante, así que queda
 * marcado is_manual=true y sin regata asociada.
 */
router.post(
  '/profile/:id/achievements/manual',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const body = req.body ?? {};

    if (
      !(MANUAL_ACHIEVEMENT_TYPES as readonly string[]).includes(
        body.achievement_type
      )
    ) {
      return res.status(422).json({ error: 'Tipo de logro inválido' });
    }
    if (!isNonEmptyString(body.regatta_name)) {
      return res.status(400).json({ error: 'El nombre de la regata es obligatorio' });
    }
    if (!isIsoDate(body.regatta_date)) {
      return res.status(422).json({ error: 'La fecha de la regata no es válida' });
    }
    // Un logro futuro no es un logro.
    if (body.regatta_date > new Date().toISOString().slice(0, 10)) {
      return res.status(422).json({ error: 'La fecha no puede ser futura' });
    }

    const position =
      body.position === undefined || body.position === null || body.position === ''
        ? null
        : Number(body.position);
    const totalEntries =
      body.total_entries === undefined ||
      body.total_entries === null ||
      body.total_entries === ''
        ? null
        : Number(body.total_entries);

    if (position !== null && (!Number.isInteger(position) || position < 1)) {
      return res.status(422).json({ error: 'La posición debe ser un entero positivo' });
    }
    if (
      totalEntries !== null &&
      (!Number.isInteger(totalEntries) || totalEntries < 1)
    ) {
      return res.status(422).json({ error: 'Los inscriptos deben ser un entero positivo' });
    }
    if (position !== null && totalEntries !== null && position > totalEntries) {
      return res
        .status(422)
        .json({ error: 'La posición no puede ser mayor que la cantidad de inscriptos' });
    }

    const { data, error } = await supabaseAdmin
      .from('regatta_achievements')
      .insert({
        user_id: req.params.id,
        achievement_type: body.achievement_type,
        regatta_id: null,
        regatta_class_id: null,
        regatta_name: body.regatta_name.trim().slice(0, 200),
        regatta_class: cleanText(body.regatta_class, 50),
        regatta_date: body.regatta_date,
        position,
        total_entries: totalEntries,
        boat_name: cleanText(body.boat_name, 100),
        notes: cleanText(body.notes, 1000),
        is_manual: true,
      })
      .select(ACHIEVEMENT_FIELDS)
      .single();

    if (error) throw error;
    return res.status(201).json({ achievement: data });
  })
);

/**
 * DELETE /api/users/profile/:id/achievements/:achievementId — solo el
 * dueño y solo los manuales: borrar uno automático rompería la
 * trazabilidad con la regata que lo generó.
 */
router.delete(
  '/profile/:id/achievements/:achievementId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!assertOwner(req, res)) return;

    const { data: existing } = await supabaseAdmin
      .from('regatta_achievements')
      .select('id, is_manual')
      .eq('id', req.params.achievementId)
      .eq('user_id', req.params.id)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: 'Logro no encontrado' });
    if (!existing.is_manual) {
      return res.status(422).json({
        error:
          'Este logro viene de una regata de la plataforma y no se puede borrar',
      });
    }

    const { error } = await supabaseAdmin
      .from('regatta_achievements')
      .delete()
      .eq('id', existing.id);

    if (error) throw error;
    return res.status(204).send();
  })
);

export default router;
