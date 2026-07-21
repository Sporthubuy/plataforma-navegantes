import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isValidUsername } from '../lib/validation';
import { extForMime, imageUpload } from '../lib/upload';
import { getUserPermissions } from '../middleware/permissions';
import { sanitizeProfileExtras } from '../lib/profile-fields';
import { computeStandings } from '../lib/scoring';

const router = Router();

const EXTRA_FIELDS =
  'club, sailing_class, usual_role, location, instagram, facebook, youtube, website';
const PROFILE_FIELDS = `id, username, name, bio, avatar_url, created_at, ${EXTRA_FIELDS}`;
const ME_FIELDS = `id, username, name, bio, avatar_url, created_at, account_type, status, ${EXTRA_FIELDS}`;

/** Quita el @ inicial (si lo escribieron) y normaliza a minúsculas. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, '');
}

/**
 * GET /api/users/me — requiere auth.
 * Perfil del usuario autenticado + su array de permisos, para que el
 * frontend sepa qué UI de administración mostrar.
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(ME_FIELDS)
      .eq('id', req.user!.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const permissions = await getUserPermissions(req.user!.id);
    return res.json({ profile: data, permissions });
  })
);

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
 * GET /api/users/:id/regatta-history — público.
 * Historial del navegante: campeonato + CLASE en la que corrió, con su
 * posición final en esa clase si ya terminó. Más reciente primero.
 */
router.get(
  '/:id/regatta-history',
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { data: boats } = await supabaseAdmin
      .from('boats')
      .select('id, name')
      .eq('owner_id', userId);
    const boatIds = (boats ?? []).map((b) => b.id);
    if (boatIds.length === 0) {
      return res.json({ history: [] });
    }
    const boatName = new Map((boats ?? []).map((b) => [b.id, b.name]));

    const { data: entries } = await supabaseAdmin
      .from('regatta_entries')
      .select(
        'id, boat_id, regatta_class_id, regatta_class:regatta_classes(id, sailing_class, discards_count, status, regatta:regattas(id, name, location, start_date))'
      )
      .in('boat_id', boatIds)
      .eq('status', 'confirmed');

    type ClassRow = {
      id: string;
      sailing_class: string;
      discards_count: number;
      status: string;
      regatta: {
        id: string;
        name: string;
        location: string | null;
        start_date: string;
      } | null;
    };

    // Posiciones finales: una pasada por CLASE terminada.
    const finishedClasses = new Map<string, ClassRow>();
    for (const e of entries ?? []) {
      const cls = e.regatta_class as unknown as ClassRow | null;
      if (cls?.status === 'finished') finishedClasses.set(cls.id, cls);
    }

    const rankByEntry = new Map<
      string,
      { position: number; total_entries: number; points: number }
    >();
    await Promise.all(
      [...finishedClasses.values()].map(async (cls) => {
        const [{ data: clsEntries }, { data: races }] = await Promise.all([
          supabaseAdmin
            .from('regatta_entries')
            .select('id')
            .eq('regatta_class_id', cls.id)
            .eq('status', 'confirmed'),
          supabaseAdmin
            .from('races')
            .select('id, race_number, status')
            .eq('regatta_class_id', cls.id),
        ]);
        const entryIds = (clsEntries ?? []).map((e) => e.id);
        const raceIds = (races ?? []).map((r) => r.id);
        let results: Array<{
          race_id: string;
          entry_id: string;
          position: number | null;
          code: string | null;
        }> = [];
        if (raceIds.length > 0) {
          const { data: rr } = await supabaseAdmin
            .from('race_results')
            .select('race_id, entry_id, position, code')
            .in('race_id', raceIds);
          results = rr ?? [];
        }
        const computed = computeStandings(
          entryIds,
          races ?? [],
          results,
          cls.discards_count
        );
        for (const s of computed.standings) {
          rankByEntry.set(s.entry_id, {
            position: s.rank,
            total_entries: entryIds.length,
            points: s.total,
          });
        }
      })
    );

    const history = (entries ?? [])
      .map((e) => {
        const cls = e.regatta_class as unknown as ClassRow | null;
        const regatta = cls?.regatta;
        if (!cls || !regatta) return null;
        const rank = rankByEntry.get(e.id);
        return {
          entry_id: e.id,
          regatta_id: regatta.id,
          regatta_name: regatta.name,
          regatta_class_id: cls.id,
          sailing_class: cls.sailing_class,
          class_status: cls.status,
          location: regatta.location,
          start_date: regatta.start_date,
          status: cls.status,
          boat_name: boatName.get(e.boat_id) ?? null,
          position: rank?.position ?? null,
          total_entries: rank?.total_entries ?? null,
          points: rank?.points ?? null,
        };
      })
      .filter((x) => x !== null)
      .sort((a, b) => (a!.start_date < b!.start_date ? 1 : -1));

    return res.json({ history });
  })
);

/**
 * GET /api/users/profile/:id/stats — público.
 * Estadísticas del navegante: barcos propios, tripulaciones aceptadas
 * y fecha de alta (para calcular antigüedad).
 */
router.get(
  '/profile/:id/stats',
  asyncHandler(async (req, res) => {
    const userId = req.params.id;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .maybeSingle();

    if (!profile) {
      return res.status(404).json({ error: 'Perfil no encontrado' });
    }

    const [boats, crews] = await Promise.all([
      supabaseAdmin
        .from('boats')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId),
      supabaseAdmin
        .from('crew_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'accepted'),
    ]);

    if (boats.error) throw boats.error;
    if (crews.error) throw crews.error;

    return res.json({
      boats_owned: boats.count ?? 0,
      crews_joined: crews.count ?? 0,
      member_since: profile.created_at,
    });
  })
);

/**
 * PUT /api/users/profile/:id — requiere auth, solo el dueño.
 * Campos editables: username, name, bio, avatar_url, datos náuticos y redes.
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

    // Datos náuticos y redes (sanitizados).
    const extras = sanitizeProfileExtras(req.body ?? {});
    if ('error' in extras) {
      return res.status(extras.error.status).json({ error: extras.error.message });
    }
    Object.assign(updates, extras.updates);

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
