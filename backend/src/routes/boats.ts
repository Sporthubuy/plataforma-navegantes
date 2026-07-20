import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';
import { extForMime, imageUpload } from '../lib/upload';

const router = Router();

const BOAT_FIELDS =
  'id, name, sail_number, category, photo_url, owner_id, created_at, updated_at';
const BOAT_WITH_OWNER = `${BOAT_FIELDS}, owner:profiles(id, username, name, avatar_url)`;

/** Devuelve el barco si existe; responde 404/403 y devuelve null si no aplica. */
async function findOwnedBoat(
  boatId: string,
  userId: string,
  res: import('express').Response
) {
  const { data: boat, error } = await supabaseAdmin
    .from('boats')
    .select('id, owner_id')
    .eq('id', boatId)
    .maybeSingle();

  if (error) throw error;
  if (!boat) {
    res.status(404).json({ error: 'Barco no encontrado' });
    return null;
  }
  if (boat.owner_id !== userId) {
    res.status(403).json({ error: 'Solo el dueño del barco puede hacer esto' });
    return null;
  }
  return boat;
}

/**
 * POST /api/boats — requiere auth. Crea un barco del usuario autenticado.
 */
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, sail_number, category, photo_url } = req.body ?? {};

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'El nombre del barco es obligatorio' });
    }
    if (!isNonEmptyString(category)) {
      return res.status(400).json({ error: 'La categoría es obligatoria' });
    }

    const { data, error } = await supabaseAdmin
      .from('boats')
      .insert({
        owner_id: req.user!.id,
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
 * GET /api/boats/mine — requiere auth.
 * Barcos donde soy owner + barcos donde soy tripulante aceptado,
 * con `relation` ('owner' | 'crew') y `my_role` para los de tripulante.
 */
router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    const [owned, crewed] = await Promise.all([
      supabaseAdmin
        .from('boats')
        .select(BOAT_WITH_OWNER)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('crew_members')
        .select(`id, role, boat:boats(${BOAT_WITH_OWNER})`)
        .eq('user_id', userId)
        .eq('status', 'accepted')
        .order('invited_at', { ascending: false }),
    ]);

    if (owned.error) throw owned.error;
    if (crewed.error) throw crewed.error;

    const boats = [
      ...(owned.data ?? []).map((boat) => ({
        ...boat,
        relation: 'owner' as const,
        my_role: null,
        crew_member_id: null,
      })),
      ...(crewed.data ?? []).flatMap((member) =>
        member.boat
          ? [
              {
                ...(member.boat as unknown as Record<string, unknown>),
                relation: 'crew' as const,
                my_role: member.role,
                crew_member_id: member.id,
              },
            ]
          : []
      ),
    ];

    return res.json({ boats });
  })
);

/**
 * GET /api/boats/:id — público.
 * Barco con datos del owner y tripulantes aceptados.
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { data: boat, error } = await supabaseAdmin
      .from('boats')
      .select(BOAT_WITH_OWNER)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!boat) {
      return res.status(404).json({ error: 'Barco no encontrado' });
    }

    const { data: crew, error: crewError } = await supabaseAdmin
      .from('crew_members')
      .select('id, role, invited_at, user:profiles(id, username, name, avatar_url)')
      .eq('boat_id', boat.id)
      .eq('status', 'accepted')
      .order('invited_at', { ascending: true });

    if (crewError) throw crewError;
    return res.json({ boat: { ...boat, crew: crew ?? [] } });
  })
);

/**
 * PUT /api/boats/:id — solo el owner. Edita name, sail_number,
 * category y photo_url.
 */
router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const boat = await findOwnedBoat(req.params.id, req.user!.id, res);
    if (!boat) return;

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
      .eq('id', boat.id)
      .select(BOAT_WITH_OWNER)
      .single();

    if (error) throw error;
    return res.json({ boat: data });
  })
);

/**
 * DELETE /api/boats/:id — solo el owner.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const boat = await findOwnedBoat(req.params.id, req.user!.id, res);
    if (!boat) return;

    const { error } = await supabaseAdmin.from('boats').delete().eq('id', boat.id);
    if (error) throw error;
    return res.status(204).send();
  })
);

/**
 * POST /api/boats/:id/photo — solo el owner.
 * Sube la foto al bucket "boats" como {boat_id}.{ext} y actualiza photo_url.
 */
router.post(
  '/:id/photo',
  requireAuth,
  imageUpload.single('file'),
  asyncHandler(async (req, res) => {
    const boat = await findOwnedBoat(req.params.id, req.user!.id, res);
    if (!boat) return;

    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo (campo "file")' });
    }

    const path = `${boat.id}.${extForMime(req.file.mimetype)}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('boats')
      .upload(path, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: pub } = supabaseAdmin.storage.from('boats').getPublicUrl(path);
    const photoUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { data, error } = await supabaseAdmin
      .from('boats')
      .update({ photo_url: photoUrl })
      .eq('id', boat.id)
      .select(BOAT_WITH_OWNER)
      .single();

    if (error) throw error;
    return res.json({ boat: data, photo_url: photoUrl });
  })
);

export default router;
