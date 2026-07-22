import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// El autor se embebe vía la relación con profiles.
const POST_WITH_AUTHOR =
  'id, title, content, image_url, created_at, updated_at, author_id, author:profiles(id, username, name, avatar_url)';

const COMMENT_WITH_AUTHOR =
  'id, content, created_at, post_id, author_id, author:profiles(id, username, name, avatar_url)';

/** User id si hay un Bearer token válido; null si no (lectura anónima). */
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

interface PostEngagement {
  likes_count: number;
  comments_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  recent_comments: unknown[];
}

/**
 * Adjunta a un conjunto de posts sus contadores (likes y comentarios),
 * el estado del usuario que consulta y los 2 comentarios más recientes.
 * Hace 4 consultas en total, no N por post.
 */
async function attachEngagement(
  posts: Array<{ id: string }>,
  userId: string | null
): Promise<Map<string, PostEngagement>> {
  const map = new Map<string, PostEngagement>();
  const ids = posts.map((p) => p.id);
  if (ids.length === 0) return map;

  for (const id of ids) {
    map.set(id, {
      likes_count: 0,
      comments_count: 0,
      liked_by_me: false,
      saved_by_me: false,
      recent_comments: [],
    });
  }

  const [likes, comments, mySaves] = await Promise.all([
    supabaseAdmin.from('post_likes').select('post_id, user_id').in('post_id', ids),
    supabaseAdmin
      .from('comments')
      .select(COMMENT_WITH_AUTHOR)
      .in('post_id', ids)
      .order('created_at', { ascending: false }),
    userId
      ? supabaseAdmin
          .from('post_saves')
          .select('post_id')
          .eq('user_id', userId)
          .in('post_id', ids)
      : Promise.resolve({ data: [] as Array<{ post_id: string }> }),
  ]);

  for (const l of likes.data ?? []) {
    const e = map.get(l.post_id)!;
    e.likes_count++;
    if (userId && l.user_id === userId) e.liked_by_me = true;
  }

  for (const c of comments.data ?? []) {
    const e = map.get(c.post_id)!;
    e.comments_count++;
    // Los 2 más recientes para la vista previa del feed.
    if (e.recent_comments.length < 2) e.recent_comments.push(c);
  }

  for (const s of (mySaves.data ?? []) as Array<{ post_id: string }>) {
    const e = map.get(s.post_id);
    if (e) e.saved_by_me = true;
  }

  return map;
}

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

    const posts = data ?? [];
    const engagement = await attachEngagement(posts, optionalUserId(req));

    return res.json({
      posts: posts.map((p) => ({ ...p, ...engagement.get(p.id) })),
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

    const engagement = await attachEngagement([data], optionalUserId(req));
    return res.json({ post: { ...data, ...engagement.get(data.id) } });
  })
);

/**
 * POST /api/posts/:id/like — requiere auth. Alterna el "me gusta".
 * Idempotente: devuelve el estado y el contador resultantes.
 */
router.post(
  '/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const userId = req.user!.id;

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const { data: existing } = await supabaseAdmin
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('post_likes')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId });
      // Carrera con un doble click: el UNIQUE lo absorbe.
      if (error && error.code !== '23505') throw error;
    }

    const { count } = await supabaseAdmin
      .from('post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId);

    return res.json({ liked: !existing, likes_count: count ?? 0 });
  })
);

/**
 * POST /api/posts/:id/save — requiere auth. Alterna el guardado (privado).
 */
router.post(
  '/:id/save',
  requireAuth,
  asyncHandler(async (req, res) => {
    const postId = req.params.id;
    const userId = req.user!.id;

    const { data: post } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle();
    if (!post) {
      return res.status(404).json({ error: 'Post no encontrado' });
    }

    const { data: existing } = await supabaseAdmin
      .from('post_saves')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from('post_saves')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('post_saves')
        .insert({ post_id: postId, user_id: userId });
      if (error && error.code !== '23505') throw error;
    }

    return res.json({ saved: !existing });
  })
);

/**
 * GET /api/posts/saved/mine — requiere auth. Posts guardados del usuario.
 */
router.get(
  '/saved/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: saves } = await supabaseAdmin
      .from('post_saves')
      .select('post_id')
      .eq('user_id', req.user!.id)
      .order('created_at', { ascending: false });

    const ids = (saves ?? []).map((s) => s.post_id);
    if (ids.length === 0) return res.json({ posts: [] });

    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(POST_WITH_AUTHOR)
      .in('id', ids);
    if (error) throw error;

    const posts = data ?? [];
    const engagement = await attachEngagement(posts, req.user!.id);
    return res.json({
      posts: posts.map((p) => ({ ...p, ...engagement.get(p.id) })),
    });
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
