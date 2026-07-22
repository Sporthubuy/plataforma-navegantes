import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';
import { extForMime, imageUpload } from '../lib/upload';

const router = Router();

const BOAT_FIELDS = `
  id, name, sail_number, category, photo_url, owner_id, created_at, updated_at,
  builder, model, designer, year_built, hull_material,
  registration_number, home_port, flag,
  rating_system, rating_value, crew_capacity
`;
const BOAT_WITH_OWNER = `${BOAT_FIELDS}, owner:profiles(id, username, name, avatar_url)`;

export const HULL_MATERIALS = [
  'Fibra',
  'Madera',
  'Aluminio',
  'Acero',
  'Carbono',
  'Otro',
] as const;
export const RATING_SYSTEMS = ['ORC', 'IRC', 'PHRF', 'Otro'] as const;

/** Campos de texto libre de la ficha ampliada: columna → largo máximo. */
const TEXT_DETAILS: Record<string, number> = {
  builder: 100,
  model: 100,
  designer: 100,
  registration_number: 50,
  home_port: 100,
};

type DetailsResult =
  | { updates: Record<string, unknown>; error?: undefined }
  | { updates?: undefined; error: string };

/**
 * Valida y normaliza los campos opcionales de la ficha del barco.
 * Solo toca las claves presentes en el body: mandar `null` o `''`
 * limpia el campo, y omitirlo lo deja como está.
 *
 * `currentRatingSystem` es el que ya tiene el barco en la base, para
 * poder aceptar un `rating_value` suelto en un PUT sin violar el
 * CHECK que exige sistema cuando hay valor.
 */
function parseBoatDetails(
  body: Record<string, unknown>,
  currentRatingSystem: string | null = null
): DetailsResult {
  const updates: Record<string, unknown> = {};

  for (const [field, maxLength] of Object.entries(TEXT_DETAILS)) {
    const raw = body[field];
    if (raw === undefined) continue;
    if (!isNonEmptyString(raw)) {
      updates[field] = null;
      continue;
    }
    const value = raw.trim();
    if (value.length > maxLength) {
      return { error: `El campo no puede superar los ${maxLength} caracteres` };
    }
    updates[field] = value;
  }

  if (body.year_built !== undefined) {
    if (body.year_built === null || body.year_built === '') {
      updates.year_built = null;
    } else {
      const year = Number(body.year_built);
      // Se permiten un par de años hacia adelante: los barcos se
      // encargan antes de estar botados.
      const maxYear = new Date().getFullYear() + 2;
      if (!Number.isInteger(year) || year < 1800 || year > maxYear) {
        return { error: `El año debe estar entre 1800 y ${maxYear}` };
      }
      updates.year_built = year;
    }
  }

  if (body.hull_material !== undefined) {
    if (!isNonEmptyString(body.hull_material)) {
      updates.hull_material = null;
    } else if (
      !(HULL_MATERIALS as readonly string[]).includes(body.hull_material.trim())
    ) {
      return { error: 'Material de casco no válido' };
    } else {
      updates.hull_material = body.hull_material.trim();
    }
  }

  if (body.flag !== undefined) {
    if (!isNonEmptyString(body.flag)) {
      updates.flag = null;
    } else {
      const flag = body.flag.trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(flag)) {
        return { error: 'La bandera debe ser un código de país de 2 letras' };
      }
      updates.flag = flag;
    }
  }

  if (body.crew_capacity !== undefined) {
    if (body.crew_capacity === null || body.crew_capacity === '') {
      updates.crew_capacity = null;
    } else {
      const crew = Number(body.crew_capacity);
      if (!Number.isInteger(crew) || crew < 1 || crew > 50) {
        return { error: 'La tripulación debe ser un número entre 1 y 50' };
      }
      updates.crew_capacity = crew;
    }
  }

  if (body.rating_system !== undefined) {
    if (!isNonEmptyString(body.rating_system)) {
      updates.rating_system = null;
    } else if (
      !(RATING_SYSTEMS as readonly string[]).includes(body.rating_system.trim())
    ) {
      return { error: 'Sistema de rating no válido' };
    } else {
      updates.rating_system = body.rating_system.trim();
    }
  }

  if (body.rating_value !== undefined) {
    if (body.rating_value === null || body.rating_value === '') {
      updates.rating_value = null;
    } else {
      const value = Number(body.rating_value);
      if (!Number.isFinite(value) || value < 0 || value > 99999) {
        return { error: 'El rating debe ser un número positivo' };
      }
      updates.rating_value = value;
    }
  }

  // El valor de rating no significa nada sin saber de qué sistema es.
  const resultingSystem =
    updates.rating_system !== undefined
      ? updates.rating_system
      : currentRatingSystem;
  if (updates.rating_value != null && !resultingSystem) {
    return { error: 'Elegí el sistema de rating antes de cargar el valor' };
  }
  // Si se borra el sistema, el valor huérfano se va con él.
  if (updates.rating_system === null) updates.rating_value = null;

  return { updates };
}

/** Devuelve el barco si existe; responde 404/403 y devuelve null si no aplica. */
async function findOwnedBoat(
  boatId: string,
  userId: string,
  res: import('express').Response
) {
  const { data: boat, error } = await supabaseAdmin
    .from('boats')
    .select('id, owner_id, rating_system')
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

    const details = parseBoatDetails(req.body ?? {});
    if (details.error) {
      return res.status(400).json({ error: details.error });
    }

    const { data, error } = await supabaseAdmin
      .from('boats')
      .insert({
        owner_id: req.user!.id,
        name: name.trim(),
        category: category.trim(),
        sail_number: isNonEmptyString(sail_number) ? sail_number.trim() : null,
        photo_url: isNonEmptyString(photo_url) ? photo_url : null,
        ...details.updates,
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
 * PUT /api/boats/:id — solo el owner. Edita los datos básicos
 * (name, sail_number, category, photo_url) y la ficha ampliada.
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

    const details = parseBoatDetails(req.body ?? {}, boat.rating_system);
    if (details.error) {
      return res.status(400).json({ error: details.error });
    }
    Object.assign(updates, details.updates);

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
