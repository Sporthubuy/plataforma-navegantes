/**
 * Moderación de contenido. Todo bajo el permiso `content.moderate`.
 *
 * El admin ve el contenido de la plataforma (posts, comentarios,
 * clasificados y salidas) y puede borrarlo. No edita contenido ajeno:
 * moderar es sacar lo que no corresponde, no reescribirlo.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const AUTHOR = 'author:profiles(id, username, name, avatar_url)';
const OWNER = 'user:profiles(id, username, name, avatar_url)';

function parsePagination(query: Record<string, unknown>) {
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

// Todo el router exige moderación.
router.use(requireAuth, requirePermission('content.moderate'));

/**
 * GET /api/admin/content/:kind — lista paginada del tipo de contenido.
 * kind ∈ posts | comments | classifieds | activities.
 */
const SOURCES = {
  posts: {
    table: 'posts',
    select: `id, title, content, image_url, created_at, ${AUTHOR}`,
    order: 'created_at',
    search: 'title',
  },
  comments: {
    table: 'comments',
    select: `id, content, post_id, created_at, ${AUTHOR}`,
    order: 'created_at',
    search: null,
  },
  classifieds: {
    table: 'classifieds',
    select: `id, title, description, category, status, country, city, created_at, author:profiles(id, username, name, avatar_url)`,
    order: 'created_at',
    search: 'title',
  },
  activities: {
    table: 'sailing_hours',
    select: `id, sailed_date, hours, distance_nm, sailing_class, notes, is_public, created_at, ${OWNER}`,
    order: 'created_at',
    search: null,
  },
} as const;

type Kind = keyof typeof SOURCES;

function isKind(value: string): value is Kind {
  return value in SOURCES;
}

router.get(
  '/:kind',
  asyncHandler(async (req, res) => {
    const kind = req.params.kind;
    if (!isKind(kind)) {
      return res.status(404).json({ error: 'Tipo de contenido desconocido' });
    }

    const source = SOURCES[kind];
    const { limit, offset } = parsePagination(req.query);
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let query = supabaseAdmin
      .from(source.table)
      .select(source.select, { count: 'exact' });

    if (search && source.search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`);
      query = query.ilike(source.search, `%${escaped}%`);
    }

    const { data, error, count } = await query
      .order(source.order, { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({
      items: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/**
 * DELETE /api/admin/content/:kind/:id — borra la pieza de contenido.
 * Las cascadas de la base se encargan de lo colgado (likes, comentarios
 * de un post, requisitos de un clasificado…).
 */
router.delete(
  '/:kind/:id',
  asyncHandler(async (req, res) => {
    const kind = req.params.kind;
    if (!isKind(kind)) {
      return res.status(404).json({ error: 'Tipo de contenido desconocido' });
    }

    const { data, error } = await supabaseAdmin
      .from(SOURCES[kind].table)
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    return res.status(204).send();
  })
);

export default router;
