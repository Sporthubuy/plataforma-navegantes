import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isValidUsername } from '../lib/validation';

const router = Router();

const PROFILE_FIELDS = 'id, username, name, bio, avatar_url, created_at';

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
      if (!isValidUsername(username)) {
        return res.status(400).json({ error: 'Username inválido' });
      }
      // ¿Username tomado por otro usuario?
      const { data: existing } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', targetId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'El username ya está en uso' });
      }
      updates.username = username;
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
