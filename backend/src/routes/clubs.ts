import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

const CLUB_FIELDS =
  'id, name, short_name, country, city, website, profile_id, created_at, updated_at';

/** Escapa los comodines de LIKE para que la búsqueda sea literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// Ver la nota en lib/location.ts sobre por qué se discrimina con `in`.
type ParsedClub = { values: Record<string, unknown> } | { error: string };

/**
 * Valida y normaliza el cuerpo de un club. En modo `partial` (PUT)
 * solo se tocan las claves presentes; en modo alta, name y country
 * son obligatorios.
 */
function parseClub(
  body: Record<string, unknown>,
  partial: boolean
): ParsedClub {
  const values: Record<string, unknown> = {};

  if (!partial || body.name !== undefined) {
    if (!isNonEmptyString(body.name)) {
      return { error: 'El nombre del club es obligatorio' };
    }
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) {
      return { error: 'El nombre debe tener entre 2 y 120 caracteres' };
    }
    values.name = name;
  }

  if (!partial || body.country !== undefined) {
    if (!isNonEmptyString(body.country)) {
      return { error: 'El país es obligatorio' };
    }
    const country = body.country.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) {
      return { error: 'El país debe ser un código de 2 letras (ej: UY)' };
    }
    values.country = country;
  }

  if (body.short_name !== undefined) {
    if (!isNonEmptyString(body.short_name)) {
      values.short_name = null;
    } else {
      const short = body.short_name.trim();
      if (short.length > 20) {
        return { error: 'La sigla no puede superar los 20 caracteres' };
      }
      values.short_name = short;
    }
  }

  if (body.city !== undefined) {
    if (!isNonEmptyString(body.city)) {
      values.city = null;
    } else {
      const city = body.city.trim();
      if (city.length > 100) {
        return { error: 'La ciudad no puede superar los 100 caracteres' };
      }
      values.city = city;
    }
  }

  if (body.website !== undefined) {
    if (!isNonEmptyString(body.website)) {
      values.website = null;
    } else {
      const website = body.website.trim();
      if (!/^https?:\/\//i.test(website)) {
        return { error: 'La web debe empezar con http:// o https://' };
      }
      values.website = website;
    }
  }

  return { values };
}

/**
 * GET /api/clubs — público. Catálogo de clubes.
 * Filtros opcionales: ?country=UY, ?city=Montevideo, ?q=texto.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const country =
      typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let query = supabaseAdmin.from('clubs').select(CLUB_FIELDS).order('name');

    if (/^[A-Z]{2}$/.test(country)) query = query.eq('country', country);
    if (city) query = query.eq('city', city);
    if (q) {
      const like = `%${escapeLike(q)}%`;
      query = query.or(`name.ilike.${like},short_name.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ clubs: data ?? [] });
  })
);

/**
 * GET /api/clubs/:id — público. Ficha del club con sus números:
 * cuántos socios lo declaran y cuántos barcos lo tienen como base.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { data: club, error } = await supabaseAdmin
      .from('clubs')
      .select(CLUB_FIELDS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!club) return res.status(404).json({ error: 'Club no encontrado' });

    const [members, boats] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
      supabaseAdmin
        .from('boats')
        .select('id', { count: 'exact', head: true })
        .eq('club_id', club.id),
    ]);

    return res.json({
      club,
      stats: {
        members_count: members.count ?? 0,
        boats_count: boats.count ?? 0,
      },
    });
  })
);

/**
 * POST /api/clubs — requiere el permiso clubs.manage.
 */
router.post(
  '/',
  requireAuth,
  requirePermission('clubs.manage'),
  asyncHandler(async (req, res) => {
    const parsed = parseClub(req.body ?? {}, false);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const { data, error } = await supabaseAdmin
      .from('clubs')
      .insert(parsed.values)
      .select(CLUB_FIELDS)
      .single();

    // Índice único por (nombre, país): el club ya estaba cargado.
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un club con ese nombre en ese país' });
    }
    if (error) throw error;
    return res.status(201).json({ club: data });
  })
);

/**
 * PUT /api/clubs/:id — requiere el permiso clubs.manage.
 */
router.put(
  '/:id',
  requireAuth,
  requirePermission('clubs.manage'),
  asyncHandler(async (req, res) => {
    const parsed = parseClub(req.body ?? {}, true);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (Object.keys(parsed.values).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('clubs')
      .update(parsed.values)
      .eq('id', req.params.id)
      .select(CLUB_FIELDS)
      .maybeSingle();

    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un club con ese nombre en ese país' });
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Club no encontrado' });
    return res.json({ club: data });
  })
);

/**
 * DELETE /api/clubs/:id — requiere el permiso clubs.manage.
 * Los perfiles y barcos que lo referencian quedan sin club
 * (ON DELETE SET NULL), no se borran.
 */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('clubs.manage'),
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('clubs')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Club no encontrado' });
    return res.status(204).send();
  })
);

export default router;
