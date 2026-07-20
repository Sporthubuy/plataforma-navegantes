import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// El autor se embebe vía la relación con profiles.
const POST_WITH_AUTHOR =
  'id, title, content, image_url, created_at, updated_at, author_id, author:profiles(id, username, name, avatar_url)';

/**
 * GET /api/posts — feed paginado (?limit, ?offset), más recientes primero.
 * Devuelve los posts junto con el total.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);

    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

    const { data, error, count } = await supabaseAdmin
      .from('posts')
      .select(POST_WITH_AUTHOR, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      posts: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/**
 * GET /api/posts/:id — post individual.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(POST_WITH_AUTHOR)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    return res.json({ post: data });
  })
);

/**
 * POST /api/posts — requiere auth. Valida title y content.
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { title, content, image_url } = req.body ?? {};

    if (!isNonEmptyString(title)) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    if (!isNonEmptyString(content)) {
      return res.status(400).json({ error: 'El contenido es obligatorio' });
    }

    const { data, error } = await supabaseAdmin
      .from('posts')
      .insert({
        title,
        content,
        image_url: isNonEmptyString(image_url) ? image_url : null,
        author_id: req.user!.id,
      })
      .select(POST_WITH_AUTHOR)
      .single();

    if (error) throw error;
    return res.status(201).json({ post: data });
  })
);

/**
 * PUT /api/posts/:id — requiere auth, solo el autor.
 */
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const postId = req.params.id;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    if (existing.author_id !== req.user!.id) {
      return res
        .status(403)
        .json({ error: 'Solo el autor puede editar este post' });
    }

    const { title, content, image_url } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (image_url !== undefined) {
      updates.image_url = isNonEmptyString(image_url) ? image_url : null;
    }
    if (title !== undefined) {
      if (!isNonEmptyString(title)) {
        return res.status(400).json({ error: 'El título no puede estar vacío' });
      }
      updates.title = title;
    }
    if (content !== undefined) {
      if (!isNonEmptyString(content)) {
        return res
          .status(400)
          .json({ error: 'El contenido no puede estar vacío' });
      }
      updates.content = content;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .select(POST_WITH_AUTHOR)
      .single();

    if (error) throw error;
    return res.json({ post: data });
  })
);

/**
 * DELETE /api/posts/:id — requiere auth, solo el autor.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const postId = req.params.id;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }
    if (existing.author_id !== req.user!.id) {
      return res
        .status(403)
        .json({ error: 'Solo el autor puede eliminar este post' });
    }

    const { error } = await supabaseAdmin.from('posts').delete().eq('id', postId);
    if (error) throw error;

    return res.status(204).send();
  })
);

/**
 * GET /api/posts/:id/comments — comentarios de un post (orden cronológico).
 */
router.get(
  '/:id/comments',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select(
        'id, content, created_at, post_id, author_id, author:profiles(id, username, name, avatar_url)'
      )
      .eq('post_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return res.json({ comments: data ?? [] });
  })
);

/**
 * POST /api/posts/:id/comments — requiere auth. Valida content.
 */
router.post(
  '/:id/comments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const { content } = req.body ?? {};

    if (!isNonEmptyString(content)) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }

    // Verifica que el post exista.
    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const { data, error } = await supabaseAdmin
      .from('comments')
      .insert({ post_id: postId, content, author_id: req.user!.id })
      .select(
        'id, content, created_at, post_id, author_id, author:profiles(id, username, name, avatar_url)'
      )
      .single();

    if (error) throw error;
    return res.status(201).json({ comment: data });
  })
);

/**
 * DELETE /api/posts/comments/:id — requiere auth, solo el autor.
 */
router.delete(
  '/comments/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const commentId = req.params.id;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('comments')
      .select('author_id')
      .eq('id', commentId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    if (existing.author_id !== req.user!.id) {
      return res
        .status(403)
        .json({ error: 'Solo el autor puede eliminar este comentario' });
    }

    const { error } = await supabaseAdmin
      .from('comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;

    return res.status(204).send();
  })
);

export default router;
