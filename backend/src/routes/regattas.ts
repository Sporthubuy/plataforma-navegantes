import { Router, type Request } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';
import { computeStandings, penaltyPoints } from '../lib/scoring';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const REGATTA_FIELDS =
  'id, name, description, location, start_date, end_date, status, registration_opens_at, registration_closes_at, scoring_system, photo_url, created_by, created_at, updated_at';

const CLASS_FIELDS =
  'id, regatta_id, sailing_class, discards_count, max_entries, status, created_at, updated_at';

const ENTRY_WITH_BOAT =
  'id, regatta_id, regatta_class_id, boat_id, registered_by, sail_number, status, registered_at, boat:boats(id, name, sail_number, category, photo_url, owner:profiles(id, username, name, avatar_url))';

const VALID_STATUS = ['upcoming', 'open', 'in_progress', 'finished', 'cancelled'];

interface ClassRow {
  id: string;
  regatta_id: string;
  sailing_class: string;
  discards_count: number;
  max_entries: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}

/** Devuelve el user id si hay un Bearer token válido; null si no. */
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

/** Inscriptos confirmados por clase, para un conjunto de clases. */
async function countsByClass(classIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (classIds.length === 0) return counts;
  const { data } = await supabaseAdmin
    .from('regatta_entries')
    .select('regatta_class_id')
    .in('regatta_class_id', classIds)
    .eq('status', 'confirmed');
  for (const e of data ?? []) {
    counts.set(
      e.regatta_class_id,
      (counts.get(e.regatta_class_id) ?? 0) + 1
    );
  }
  return counts;
}

/** Calcula la tabla de clasificación de una clase. */
async function buildClassStandings(cls: {
  id: string;
  sailing_class: string;
  discards_count: number;
  status: string;
}) {
  const [{ data: entries }, { data: races }] = await Promise.all([
    supabaseAdmin
      .from('regatta_entries')
      .select(ENTRY_WITH_BOAT)
      .eq('regatta_class_id', cls.id)
      .eq('status', 'confirmed'),
    supabaseAdmin
      .from('races')
      .select('id, race_number, name, status, sailed_at')
      .eq('regatta_class_id', cls.id)
      .order('race_number', { ascending: true }),
  ]);

  const entryList = entries ?? [];
  const raceList = races ?? [];
  const raceIds = raceList.map((r) => r.id);

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
    entryList.map((e) => e.id),
    raceList,
    results,
    cls.discards_count
  );

  const entryById = new Map(entryList.map((e) => [e.id, e]));
  return {
    regatta_class: cls,
    races: raceList,
    entry_count: entryList.length,
    effective_discards: computed.effective_discards,
    completed_races: computed.completed_races,
    discards_count: computed.discards_count,
    discard_threshold: computed.discard_threshold,
    standings: computed.standings.map((s) => ({
      ...s,
      entry: entryById.get(s.entry_id) ?? null,
    })),
  };
}

// ============================================================
// LECTURA (pública)
// ============================================================

/** GET /api/regattas — campeonatos con sus clases y contadores. */
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

    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const sailingClass =
      typeof req.query.sailing_class === 'string' ? req.query.sailing_class : '';
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim() : '';

    let query = supabaseAdmin
      .from('regattas')
      .select(REGATTA_FIELDS, { count: 'exact' });

    if (status) query = query.eq('status', status);
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`);
      query = query.ilike('name', `%${escaped}%`);
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;

    const regattaIds = (data ?? []).map((r) => r.id);
    let classes: ClassRow[] = [];
    if (regattaIds.length > 0) {
      const { data: cls } = await supabaseAdmin
        .from('regatta_classes')
        .select(CLASS_FIELDS)
        .in('regatta_id', regattaIds)
        .order('sailing_class', { ascending: true });
      classes = (cls ?? []) as unknown as ClassRow[];
    }

    const counts = await countsByClass(classes.map((c) => c.id));

    let regattas = (data ?? []).map((r) => {
      const own = classes
        .filter((c) => c.regatta_id === r.id)
        .map((c) => ({ ...c, entry_count: counts.get(c.id) ?? 0 }));
      return {
        ...r,
        classes: own,
        entry_count: own.reduce((s, c) => s + c.entry_count, 0),
      };
    });

    // Filtro por clase: el campeonato debe tener esa clase.
    if (sailingClass) {
      regattas = regattas.filter((r) =>
        r.classes.some((c) => c.sailing_class === sailingClass)
      );
    }

    return res.json({
      regattas,
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/** GET /api/regattas/:id — detalle del campeonato con sus clases. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { data: regatta, error } = await supabaseAdmin
      .from('regattas')
      .select(REGATTA_FIELDS)
      .eq('id', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    const { data: classes } = await supabaseAdmin
      .from('regatta_classes')
      .select(CLASS_FIELDS)
      .eq('regatta_id', regatta.id)
      .order('sailing_class', { ascending: true });

    const classList = classes ?? [];
    const classIds = classList.map((c) => c.id);
    const counts = await countsByClass(classIds);

    // Mangas por clase.
    const racesByClass = new Map<string, unknown[]>();
    if (classIds.length > 0) {
      const { data: races } = await supabaseAdmin
        .from('races')
        .select('id, regatta_class_id, race_number, name, status, sailed_at')
        .in('regatta_class_id', classIds)
        .order('race_number', { ascending: true });
      for (const r of races ?? []) {
        const list = racesByClass.get(r.regatta_class_id) ?? [];
        list.push(r);
        racesByClass.set(r.regatta_class_id, list);
      }
    }

    // Barcos del usuario + inscripciones propias, por clase.
    const userId = optionalUserId(req);
    let myBoats: Array<{ id: string; category: string }> = [];
    let myEntries: Array<{ id: string; regatta_class_id: string; boat_id: string }> = [];
    if (userId && classIds.length > 0) {
      const [{ data: boats }, { data: entries }] = await Promise.all([
        supabaseAdmin
          .from('boats')
          .select('id, name, sail_number, category, photo_url')
          .eq('owner_id', userId),
        supabaseAdmin
          .from('regatta_entries')
          .select('id, regatta_class_id, boat_id, status')
          .in('regatta_class_id', classIds)
          .eq('status', 'confirmed'),
      ]);
      myBoats = (boats ?? []) as Array<{ id: string; category: string }>;
      const myBoatIds = new Set(myBoats.map((b) => b.id));
      myEntries = (entries ?? []).filter((e) => myBoatIds.has(e.boat_id));
    }

    const enrichedClasses = classList.map((c) => {
      const registeredBoatIds = new Set(
        myEntries.filter((e) => e.regatta_class_id === c.id).map((e) => e.boat_id)
      );
      const myEntry =
        myEntries.find((e) => e.regatta_class_id === c.id) ?? null;
      return {
        ...c,
        entry_count: counts.get(c.id) ?? 0,
        races: racesByClass.get(c.id) ?? [],
        // Barcos del usuario evaluados contra ESTA clase.
        eligible_boats: myBoats.map((b) => ({
          ...b,
          class_matches: b.category === c.sailing_class,
          already_registered: registeredBoatIds.has(b.id),
          eligible:
            b.category === c.sailing_class && !registeredBoatIds.has(b.id),
        })),
        my_entry: myEntry,
      };
    });

    return res.json({
      regatta: {
        ...regatta,
        classes: enrichedClasses,
        entry_count: enrichedClasses.reduce((s, c) => s + c.entry_count, 0),
      },
    });
  })
);

/** GET /api/regattas/:id/entries — todas las inscripciones del campeonato. */
router.get(
  '/:id/entries',
  asyncHandler(async (req, res) => {
    const { data: classes } = await supabaseAdmin
      .from('regatta_classes')
      .select('id')
      .eq('regatta_id', req.params.id);
    const classIds = (classes ?? []).map((c) => c.id);
    if (classIds.length === 0) return res.json({ entries: [] });

    const { data, error } = await supabaseAdmin
      .from('regatta_entries')
      .select(ENTRY_WITH_BOAT)
      .in('regatta_class_id', classIds)
      .order('registered_at', { ascending: true });

    if (error) throw error;
    return res.json({ entries: data ?? [] });
  })
);

/** GET /api/regattas/classes/:classId/entries — inscriptos de una clase. */
router.get(
  '/classes/:classId/entries',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('regatta_entries')
      .select(ENTRY_WITH_BOAT)
      .eq('regatta_class_id', req.params.classId)
      .order('registered_at', { ascending: true });

    if (error) throw error;
    return res.json({ entries: data ?? [] });
  })
);

/** GET /api/regattas/:id/results — resultados AGRUPADOS POR CLASE. */
router.get(
  '/:id/results',
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    const { data: classes } = await supabaseAdmin
      .from('regatta_classes')
      .select(CLASS_FIELDS)
      .eq('regatta_id', regatta.id)
      .order('sailing_class', { ascending: true });

    const blocks = await Promise.all(
      (classes ?? []).map((c) => buildClassStandings(c))
    );

    return res.json({ classes: blocks });
  })
);

/** GET /api/regattas/classes/:classId/results — tabla de una sola clase. */
router.get(
  '/classes/:classId/results',
  asyncHandler(async (req, res) => {
    const { data: cls } = await supabaseAdmin
      .from('regatta_classes')
      .select(CLASS_FIELDS)
      .eq('id', req.params.classId)
      .maybeSingle();
    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }
    return res.json(await buildClassStandings(cls));
  })
);

// ============================================================
// ADMIN — campeonato
// ============================================================

function validateDates(start: unknown, end: unknown): string | null {
  if (typeof start !== 'string' || typeof end !== 'string') {
    return 'Las fechas de inicio y fin son obligatorias';
  }
  if (new Date(end) < new Date(start)) {
    return 'La fecha de fin no puede ser anterior a la de inicio';
  }
  return null;
}

/** POST /api/regattas — crea el campeonato (sin clase ni descartes). */
router.post(
  '/',
  requireAuth,
  requirePermission('regattas.create'),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      location,
      start_date,
      end_date,
      registration_opens_at,
      registration_closes_at,
      photo_url,
    } = req.body ?? {};

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const dateError = validateDates(start_date, end_date);
    if (dateError) return res.status(422).json({ error: dateError });

    const { data, error } = await supabaseAdmin
      .from('regattas')
      .insert({
        name: name.trim(),
        description: isNonEmptyString(description) ? description.trim() : null,
        location: isNonEmptyString(location) ? location.trim() : null,
        start_date,
        end_date,
        registration_opens_at: registration_opens_at || null,
        registration_closes_at: registration_closes_at || null,
        photo_url: isNonEmptyString(photo_url) ? photo_url : null,
        created_by: req.user!.id,
      })
      .select(REGATTA_FIELDS)
      .single();

    if (error) throw error;
    return res.status(201).json({ regatta: data });
  })
);

/** PUT /api/regattas/:id — edita los datos del campeonato. */
router.put(
  '/:id',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (!isNonEmptyString(body.name)) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      updates.name = body.name.trim();
    }
    if (body.description !== undefined)
      updates.description = isNonEmptyString(body.description)
        ? body.description.trim()
        : null;
    if (body.location !== undefined)
      updates.location = isNonEmptyString(body.location) ? body.location.trim() : null;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.registration_opens_at !== undefined)
      updates.registration_opens_at = body.registration_opens_at || null;
    if (body.registration_closes_at !== undefined)
      updates.registration_closes_at = body.registration_closes_at || null;
    if (body.photo_url !== undefined)
      updates.photo_url = isNonEmptyString(body.photo_url) ? body.photo_url : null;
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      updates.status = body.status;
    }

    if (updates.start_date || updates.end_date) {
      const dateError = validateDates(
        updates.start_date ?? body.start_date,
        updates.end_date ?? body.end_date
      );
      if (dateError) return res.status(422).json({ error: dateError });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('regattas')
      .update(updates)
      .eq('id', regatta.id)
      .select(REGATTA_FIELDS)
      .single();

    if (error) throw error;
    return res.json({ regatta: data });
  })
);

/** DELETE /api/regattas/:id */
router.delete(
  '/:id',
  requireAuth,
  requirePermission('regattas.delete'),
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }
    const { error } = await supabaseAdmin
      .from('regattas')
      .delete()
      .eq('id', regatta.id);
    if (error) throw error;
    return res.status(204).send();
  })
);

/** PUT /api/regattas/:id/status — estado paraguas del campeonato. */
router.put(
  '/:id/status',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const { data, error } = await supabaseAdmin
      .from('regattas')
      .update({ status })
      .eq('id', req.params.id)
      .select(REGATTA_FIELDS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Regata no encontrada' });
    return res.json({ regatta: data });
  })
);

// ============================================================
// ADMIN — clases del campeonato
// ============================================================

/** POST /api/regattas/:id/classes — agrega una clase al campeonato. */
router.post(
  '/:id/classes',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { sailing_class, discards_count, max_entries, status } = req.body ?? {};

    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }
    if (!isNonEmptyString(sailing_class)) {
      return res.status(400).json({ error: 'La clase es obligatoria' });
    }
    if (status !== undefined && !VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const { data, error } = await supabaseAdmin
      .from('regatta_classes')
      .insert({
        regatta_id: regatta.id,
        sailing_class: sailing_class.trim(),
        discards_count:
          Number.isFinite(Number(discards_count)) && Number(discards_count) >= 0
            ? Math.floor(Number(discards_count))
            : 0,
        max_entries:
          Number.isFinite(Number(max_entries)) && Number(max_entries) > 0
            ? Math.floor(Number(max_entries))
            : null,
        ...(status ? { status } : {}),
      })
      .select(CLASS_FIELDS)
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(422)
          .json({ error: 'Esa clase ya existe en este campeonato' });
      }
      throw error;
    }
    return res.status(201).json({ regatta_class: data });
  })
);

/** PUT /api/regattas/classes/:classId — edita la clase. */
router.put(
  '/classes/:classId',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { data: cls } = await supabaseAdmin
      .from('regatta_classes')
      .select('id, sailing_class')
      .eq('id', req.params.classId)
      .maybeSingle();
    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};

    if (
      body.sailing_class !== undefined &&
      body.sailing_class !== cls.sailing_class
    ) {
      const counts = await countsByClass([cls.id]);
      if ((counts.get(cls.id) ?? 0) > 0) {
        return res.status(422).json({
          error: 'No puedes cambiar la clase: ya hay barcos inscriptos',
        });
      }
      if (!isNonEmptyString(body.sailing_class)) {
        return res.status(400).json({ error: 'La clase no puede estar vacía' });
      }
      updates.sailing_class = body.sailing_class.trim();
    }
    if (body.discards_count !== undefined)
      updates.discards_count =
        Number.isFinite(Number(body.discards_count)) &&
        Number(body.discards_count) >= 0
          ? Math.floor(Number(body.discards_count))
          : 0;
    if (body.max_entries !== undefined)
      updates.max_entries =
        Number.isFinite(Number(body.max_entries)) && Number(body.max_entries) > 0
          ? Math.floor(Number(body.max_entries))
          : null;
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        return res.status(400).json({ error: 'Estado inválido' });
      }
      updates.status = body.status;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabaseAdmin
      .from('regatta_classes')
      .update(updates)
      .eq('id', cls.id)
      .select(CLASS_FIELDS)
      .single();
    if (error) throw error;
    return res.json({ regatta_class: data });
  })
);

/** PUT /api/regattas/classes/:classId/status — estado de la clase. */
router.put(
  '/classes/:classId/status',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const { data, error } = await supabaseAdmin
      .from('regatta_classes')
      .update({ status })
      .eq('id', req.params.classId)
      .select(CLASS_FIELDS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Clase no encontrada' });
    return res.json({ regatta_class: data });
  })
);

/** DELETE /api/regattas/classes/:classId — borra la clase (cascada). */
router.delete(
  '/classes/:classId',
  requireAuth,
  requirePermission('regattas.delete'),
  asyncHandler(async (req, res) => {
    const { data: cls } = await supabaseAdmin
      .from('regatta_classes')
      .select('id')
      .eq('id', req.params.classId)
      .maybeSingle();
    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }
    const { error } = await supabaseAdmin
      .from('regatta_classes')
      .delete()
      .eq('id', cls.id);
    if (error) throw error;
    return res.status(204).send();
  })
);

// ============================================================
// ADMIN — mangas y resultados (por clase)
// ============================================================

/** POST /api/regattas/classes/:classId/races — crea manga en la clase. */
router.post(
  '/classes/:classId/races',
  requireAuth,
  requirePermission('regattas.manage_results'),
  asyncHandler(async (req, res) => {
    const { data: cls } = await supabaseAdmin
      .from('regatta_classes')
      .select('id, regatta_id')
      .eq('id', req.params.classId)
      .maybeSingle();
    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }

    // Numeración correlativa DENTRO de la clase.
    let raceNumber = Number(req.body?.race_number);
    if (!Number.isFinite(raceNumber) || raceNumber <= 0) {
      const { data: last } = await supabaseAdmin
        .from('races')
        .select('race_number')
        .eq('regatta_class_id', cls.id)
        .order('race_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      raceNumber = (last?.race_number ?? 0) + 1;
    }

    const { data, error } = await supabaseAdmin
      .from('races')
      .insert({
        regatta_id: cls.regatta_id,
        regatta_class_id: cls.id,
        race_number: Math.floor(raceNumber),
        name: isNonEmptyString(req.body?.name) ? req.body.name.trim() : null,
      })
      .select('id, regatta_class_id, race_number, name, status, sailed_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Ya existe una manga con ese número en esta clase' });
      }
      throw error;
    }
    return res.status(201).json({ race: data });
  })
);

/** DELETE /api/regattas/races/:raceId — borra una manga. */
router.delete(
  '/races/:raceId',
  requireAuth,
  requirePermission('regattas.manage_results'),
  asyncHandler(async (req, res) => {
    const { data: race } = await supabaseAdmin
      .from('races')
      .select('id, regatta_class_id')
      .eq('id', req.params.raceId)
      .maybeSingle();
    if (!race) {
      return res.status(404).json({ error: 'Manga no encontrada' });
    }
    const { error } = await supabaseAdmin.from('races').delete().eq('id', race.id);
    if (error) throw error;
    return res.status(204).send();
  })
);

/**
 * PUT /api/regattas/races/:raceId/results — resultados en lote.
 * Valida que los entries pertenezcan a la CLASE de esa manga.
 */
router.put(
  '/races/:raceId/results',
  requireAuth,
  requirePermission('regattas.manage_results'),
  asyncHandler(async (req, res) => {
    const { data: race } = await supabaseAdmin
      .from('races')
      .select('id, regatta_class_id')
      .eq('id', req.params.raceId)
      .maybeSingle();
    if (!race) {
      return res.status(404).json({ error: 'Manga no encontrada' });
    }

    const input = Array.isArray(req.body) ? req.body : req.body?.results;
    if (!Array.isArray(input)) {
      return res.status(400).json({ error: 'Se espera un array de resultados' });
    }

    const { data: entries } = await supabaseAdmin
      .from('regatta_entries')
      .select('id')
      .eq('regatta_class_id', race.regatta_class_id)
      .eq('status', 'confirmed');
    const validIds = new Set((entries ?? []).map((e) => e.id));
    const entriesCount = validIds.size;

    const rows: Array<{
      race_id: string;
      entry_id: string;
      position: number | null;
      points: number;
      code: string | null;
    }> = [];
    const seenPositions = new Set<number>();

    for (const item of input) {
      const entryId = item?.entry_id;
      if (!validIds.has(entryId)) {
        return res.status(422).json({
          error: 'Un resultado no corresponde a un inscripto de esta clase',
        });
      }
      const code = isNonEmptyString(item?.code) ? item.code : null;
      let position: number | null = null;
      let points: number;

      if (code) {
        points = penaltyPoints(entriesCount);
      } else {
        position = Number(item?.position);
        if (!Number.isFinite(position) || position <= 0) {
          return res.status(422).json({
            error: 'Cada barco necesita una posición válida o un código',
          });
        }
        position = Math.floor(position);
        if (seenPositions.has(position)) {
          return res
            .status(422)
            .json({ error: `La posición ${position} está repetida` });
        }
        seenPositions.add(position);
        points = position;
      }

      rows.push({ race_id: race.id, entry_id: entryId, position, points, code });
    }

    const { error: upsertError } = await supabaseAdmin
      .from('race_results')
      .upsert(rows, { onConflict: 'race_id,entry_id' });
    if (upsertError) throw upsertError;

    const { error: raceError } = await supabaseAdmin
      .from('races')
      .update({ status: 'completed', sailed_at: new Date().toISOString() })
      .eq('id', race.id);
    if (raceError) throw raceError;

    return res.json({ updated: rows.length });
  })
);

// ============================================================
// INSCRIPCIÓN (a una clase)
// ============================================================

/** POST /api/regattas/classes/:classId/register */
router.post(
  '/classes/:classId/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { boat_id, sail_number } = req.body ?? {};
    if (!isNonEmptyString(boat_id)) {
      return res.status(400).json({ error: 'Falta el barco (boat_id)' });
    }

    // 1. La clase existe y está abierta.
    const { data: cls } = await supabaseAdmin
      .from('regatta_classes')
      .select('id, regatta_id, sailing_class, status, max_entries')
      .eq('id', req.params.classId)
      .maybeSingle();
    if (!cls) {
      return res.status(404).json({ error: 'Clase no encontrada' });
    }
    if (cls.status !== 'open') {
      return res
        .status(422)
        .json({ error: 'Las inscripciones de esta clase no están abiertas' });
    }

    // 2. Ventana de inscripción (a nivel campeonato).
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('registration_opens_at, registration_closes_at')
      .eq('id', cls.regatta_id)
      .maybeSingle();
    const now = Date.now();
    if (
      regatta?.registration_opens_at &&
      now < new Date(regatta.registration_opens_at).getTime()
    ) {
      return res.status(422).json({ error: 'La inscripción todavía no abrió' });
    }
    if (
      regatta?.registration_closes_at &&
      now > new Date(regatta.registration_closes_at).getTime()
    ) {
      return res.status(422).json({ error: 'La inscripción ya cerró' });
    }

    // 3. El barco es del usuario.
    const { data: boat } = await supabaseAdmin
      .from('boats')
      .select('id, category, sail_number, owner_id')
      .eq('id', boat_id)
      .maybeSingle();
    if (!boat) {
      return res.status(404).json({ error: 'Barco no encontrado' });
    }
    if (boat.owner_id !== req.user!.id) {
      return res
        .status(403)
        .json({ error: 'Solo el dueño del barco puede inscribirlo' });
    }

    // 4. La clase del barco coincide con la de la flota.
    if (boat.category !== cls.sailing_class) {
      return res.status(422).json({
        error: `Tu barco es clase ${boat.category}, esta flota es de clase ${cls.sailing_class}`,
      });
    }

    // 5. No inscripto ya en esta clase.
    const { data: existing } = await supabaseAdmin
      .from('regatta_entries')
      .select('id, status')
      .eq('regatta_class_id', cls.id)
      .eq('boat_id', boat.id)
      .maybeSingle();
    if (existing && existing.status === 'confirmed') {
      return res
        .status(409)
        .json({ error: 'Ese barco ya está inscripto en esta clase' });
    }

    // 6. Cupo de la clase.
    if (cls.max_entries != null) {
      const counts = await countsByClass([cls.id]);
      if ((counts.get(cls.id) ?? 0) >= cls.max_entries) {
        return res.status(422).json({ error: 'Esta clase alcanzó su cupo' });
      }
    }

    const finalSail = isNonEmptyString(sail_number)
      ? sail_number.trim()
      : boat.sail_number;

    let entry;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('regatta_entries')
        .update({
          status: 'confirmed',
          sail_number: finalSail,
          registered_by: req.user!.id,
          registered_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(ENTRY_WITH_BOAT)
        .single();
      if (error) throw error;
      entry = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('regatta_entries')
        .insert({
          regatta_id: cls.regatta_id,
          regatta_class_id: cls.id,
          boat_id: boat.id,
          registered_by: req.user!.id,
          sail_number: finalSail,
        })
        .select(ENTRY_WITH_BOAT)
        .single();
      if (error) throw error;
      entry = data;
    }

    return res.status(201).json({ entry });
  })
);

/** DELETE /api/regattas/classes/:classId/register — retira la inscripción. */
router.delete(
  '/classes/:classId/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: entries } = await supabaseAdmin
      .from('regatta_entries')
      .select('id, registered_by, boat:boats(owner_id)')
      .eq('regatta_class_id', req.params.classId)
      .eq('status', 'confirmed');

    const mine = (entries ?? []).find(
      (e) =>
        e.registered_by === req.user!.id ||
        (e.boat as unknown as { owner_id?: string } | null)?.owner_id ===
          req.user!.id
    );
    if (!mine) {
      return res.status(404).json({ error: 'No tienes una inscripción activa' });
    }

    const { error } = await supabaseAdmin
      .from('regatta_entries')
      .update({ status: 'withdrawn' })
      .eq('id', mine.id);
    if (error) throw error;

    return res.status(204).send();
  })
);

export default router;
