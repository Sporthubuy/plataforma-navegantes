import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isValidUsername } from '../lib/validation';
import { extForMime, imageUpload } from '../lib/upload';

const router = Router();

const PROFILE_FIELDS = 'id, username, name, bio, avatar_url, created_at';

/** Quita el @ inicial (si lo escribieron) y normaliza a minúsculas. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

/**
 * GET /api/users/search?q=texto — requiere auth.
 * Busca perfiles cuyo username empiece con el texto (sin @),
 * para el autocompletado al invitar tripulantes. Máximo 10.
 */
router.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const raw = typeof req.query.q === 'string' ? req.query.q : '';
    const q = normalizeUsername(raw);

    if (!q) {
      return res.json({ users: [] });
    }

    const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, username, name, avatar_url')
      .ilike('username', `${escaped}%`)
      .order('username')
      .limit(10);

    if (error) throw error;
    return res.json({ users: data ?? [] });
  })
);

/**
 * POST /api/users/avatar — requiere auth.
 * Sube la foto de perfil al bucket "avatars" como {user_id}.{ext}
 * y actualiza avatar_url. Devuelve la URL pública.
 */
router.post(
  '/avatar',
  requireAuth,
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo (campo "file")' });
    }

    const userId = req.user!.id;
    const path = `${userId}.${extForMime(req.file.mimetype)}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    // ?v= para invalidar cachés cuando se reemplaza la foto.
    const { data: pub } = supabaseAdmin.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select(PROFILE_FIELDS)
      .single();

    if (error) throw error;
    return res.json({ profile: data, avatar_url: avatarUrl });
  })
);

/**
 * GET /api/users/profile/:id — público.
 */
router.get(
  '/profile/:id',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }
    return res.json({ profile: data });
  })
);

/**
 * GET /api/users/profile/username/:username — público.
 */
router.get(
  '/profile/username/:username',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('username', req.params.username)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }
    return res.json({ profile: data });
  })
);

/**
 * PUT /api/users/profile/:id — requiere auth, solo el dueño.
 * Campos editables: username, name, bio, avatar_url.
 */
router.put(
  '/profile/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;

    if (req.user!.id !== targetId) {
      return res
        .status(403)
        .json({ error: 'Solo puedes editar tu propio perfil' });
    }

    const { username, name, bio, avatar_url } = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (username !== undefined) {
      const normalized =
        typeof username === 'string' ? normalizeUsername(username) : '';
      if (!isValidUsername(normalized)) {
        return res.status(422).json({
          error:
            'Username inválido: 3-20 caracteres, solo minúsculas, números y guion bajo',
        });
      }
      // ¿Username tomado por otro usuario?
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .neq('id', targetId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      updates.username = normalized;
    }

    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .eq('id', targetId)
      .select(PROFILE_FIELDS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      throw error;
    }
    if (!data) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }
    return res.json({ profile: data });
  })
);

/**
 * DELETE /api/users/profile/:id — requiere auth, solo el dueño.
 * Elimina el usuario de Auth; el perfil cae por ON DELETE CASCADE.
 */
router.delete(
  '/profile/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;

    if (req.user!.id !== targetId) {
      return res
        .status(403)
        .json({ error: 'Solo puedes eliminar tu propia cuenta' });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
    if (error) throw error;

    return res.status(204).send();
  })
);

export default router;
