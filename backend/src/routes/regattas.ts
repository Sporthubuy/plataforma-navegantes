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
  'id, name, description, sailing_class, location, start_date, end_date, status, registration_opens_at, registration_closes_at, max_entries, scoring_system, discards_count, photo_url, created_by, created_at, updated_at';

const ENTRY_WITH_BOAT =
  'id, regatta_id, boat_id, registered_by, sail_number, status, registered_at, boat:boats(id, name, sail_number, category, photo_url, owner:profiles(id, username, name, avatar_url))';

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

/** Cantidad de inscriptos confirmados de una regata. */
async function confirmedCount(regattaId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('regatta_entries')
    .select('id', { count: 'exact', head: true })
    .eq('regatta_id', regattaId)
    .eq('status', 'confirmed');
  return count ?? 0;
}

// ============================================================
// LECTURA (pública)
// ============================================================

/** GET /api/regattas — lista paginada con filtros y contador de inscriptos. */
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

    let query = supabaseAdmin
      .from('regattas')
      .select(REGATTA_FIELDS, { count: 'exact' });

    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const sailingClass =
      typeof req.query.sailing_class === 'string' ? req.query.sailing_class : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    if (status) query = query.eq('status', status);
    if (sailingClass) query = query.eq('sailing_class', sailingClass);
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (m) => `\\${m}`);
      query = query.ilike('name', `%${escaped}%`);
    }

    const { data, error, count } = await query
      .order('start_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Contador de inscriptos confirmados por regata.
    const ids = (data ?? []).map((r) => r.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: entries } = await supabaseAdmin
        .from('regatta_entries')
        .select('regatta_id')
        .in('regatta_id', ids)
        .eq('status', 'confirmed');
      for (const e of entries ?? []) {
        counts.set(e.regatta_id, (counts.get(e.regatta_id) ?? 0) + 1);
      }
    }

    const regattas = (data ?? []).map((r) => ({
      ...r,
      entry_count: counts.get(r.id) ?? 0,
    }));

    return res.json({
      regattas,
      pagination: { limit, offset, total: count ?? 0 },
    });
  })
);

/** GET /api/regattas/:id — detalle con mangas, inscriptos y barcos elegibles. */
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

    const [races, entryCount] = await Promise.all([
      supabaseAdmin
        .from('races')
        .select('id, race_number, name, status, sailed_at')
        .eq('regatta_id', regatta.id)
        .order('race_number', { ascending: true }),
      confirmedCount(regatta.id),
    ]);

    // Barcos elegibles del usuario autenticado (clase coincide y no inscripto).
    let eligibleBoats: unknown[] = [];
    let myEntry: unknown = null;
    const userId = optionalUserId(req);
    if (userId) {
      const [{ data: boats }, { data: entries }] = await Promise.all([
        supabaseAdmin
          .from('boats')
          .select('id, name, sail_number, category, photo_url')
          .eq('owner_id', userId),
        supabaseAdmin
          .from('regatta_entries')
          .select('id, boat_id, status')
          .eq('regatta_id', regatta.id),
      ]);
      const registeredBoatIds = new Set(
        (entries ?? [])
          .filter((e) => e.status === 'confirmed')
          .map((e) => e.boat_id)
      );
      eligibleBoats = (boats ?? []).map((b) => ({
        ...b,
        eligible:
          b.category === regatta.sailing_class && !registeredBoatIds.has(b.id),
        class_matches: b.category === regatta.sailing_class,
        already_registered: registeredBoatIds.has(b.id),
      }));
      // ¿El usuario ya tiene una entry confirmada (con alguno de sus barcos)?
      const myBoatIds = new Set((boats ?? []).map((b) => b.id));
      myEntry =
        (entries ?? []).find(
          (e) => e.status === 'confirmed' && myBoatIds.has(e.boat_id)
        ) ?? null;
    }

    return res.json({
      regatta: {
        ...regatta,
        entry_count: entryCount,
        races: races.data ?? [],
      },
      eligible_boats: eligibleBoats,
      my_entry: myEntry,
    });
  })
);

/** GET /api/regattas/:id/entries — inscriptos con barco y owner. */
router.get(
  '/:id/entries',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('regatta_entries')
      .select(ENTRY_WITH_BOAT)
      .eq('regatta_id', req.params.id)
      .order('registered_at', { ascending: true });

    if (error) throw error;
    return res.json({ entries: data ?? [] });
  })
);

/** GET /api/regattas/:id/results — tabla de clasificación general. */
router.get(
  '/:id/results',
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id, discards_count')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    const [{ data: entries }, { data: races }] = await Promise.all([
      supabaseAdmin
        .from('regatta_entries')
        .select(ENTRY_WITH_BOAT)
        .eq('regatta_id', regatta.id)
        .eq('status', 'confirmed'),
      supabaseAdmin
        .from('races')
        .select('id, race_number, status')
        .eq('regatta_id', regatta.id)
        .order('race_number', { ascending: true }),
    ]);

    const entryList = entries ?? [];
    const raceList = races ?? [];
    const entryIds = entryList.map((e) => e.id);

    // Resultados de todas las mangas de la regata.
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

    const standings = computeStandings(
      entryIds,
      raceList,
      results,
      regatta.discards_count
    );

    // Adjuntar datos de barco/owner para mostrar.
    const entryById = new Map(entryList.map((e) => [e.id, e]));
    const table = standings.map((s) => ({
      ...s,
      entry: entryById.get(s.entry_id) ?? null,
    }));

    return res.json({
      races: raceList,
      standings: table,
    });
  })
);

// ============================================================
// ADMIN — gestión de regata
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

/** POST /api/regattas — crea una regata (regattas.create). */
router.post(
  '/',
  requireAuth,
  requirePermission('regattas.create'),
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      sailing_class,
      location,
      start_date,
      end_date,
      registration_opens_at,
      registration_closes_at,
      max_entries,
      discards_count,
      photo_url,
    } = req.body ?? {};

    if (!isNonEmptyString(name)) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!isNonEmptyString(sailing_class)) {
      return res.status(400).json({ error: 'La clase es obligatoria' });
    }
    const dateError = validateDates(start_date, end_date);
    if (dateError) return res.status(422).json({ error: dateError });

    const { data, error } = await supabaseAdmin
      .from('regattas')
      .insert({
        name: name.trim(),
        description: isNonEmptyString(description) ? description.trim() : null,
        sailing_class: sailing_class.trim(),
        location: isNonEmptyString(location) ? location.trim() : null,
        start_date,
        end_date,
        registration_opens_at: registration_opens_at || null,
        registration_closes_at: registration_closes_at || null,
        max_entries:
          Number.isFinite(Number(max_entries)) && Number(max_entries) > 0
            ? Math.floor(Number(max_entries))
            : null,
        discards_count:
          Number.isFinite(Number(discards_count)) && Number(discards_count) >= 0
            ? Math.floor(Number(discards_count))
            : 0,
        photo_url: isNonEmptyString(photo_url) ? photo_url : null,
        created_by: req.user!.id,
      })
      .select(REGATTA_FIELDS)
      .single();

    if (error) throw error;
    return res.status(201).json({ regatta: data });
  })
);

/** PUT /api/regattas/:id — edita datos (regattas.edit). */
router.put(
  '/:id',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id, sailing_class')
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
    if (body.sailing_class !== undefined && body.sailing_class !== regatta.sailing_class) {
      // No permitir cambiar la clase si ya hay inscriptos.
      const count = await confirmedCount(regatta.id);
      if (count > 0) {
        return res.status(422).json({
          error: 'No puedes cambiar la clase: ya hay barcos inscriptos',
        });
      }
      if (!isNonEmptyString(body.sailing_class)) {
        return res.status(400).json({ error: 'La clase no puede estar vacía' });
      }
      updates.sailing_class = body.sailing_class.trim();
    }
    if (body.description !== undefined)
      updates.description = isNonEmptyString(body.description) ? body.description.trim() : null;
    if (body.location !== undefined)
      updates.location = isNonEmptyString(body.location) ? body.location.trim() : null;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.registration_opens_at !== undefined)
      updates.registration_opens_at = body.registration_opens_at || null;
    if (body.registration_closes_at !== undefined)
      updates.registration_closes_at = body.registration_closes_at || null;
    if (body.max_entries !== undefined)
      updates.max_entries =
        Number.isFinite(Number(body.max_entries)) && Number(body.max_entries) > 0
          ? Math.floor(Number(body.max_entries))
          : null;
    if (body.discards_count !== undefined)
      updates.discards_count =
        Number.isFinite(Number(body.discards_count)) && Number(body.discards_count) >= 0
          ? Math.floor(Number(body.discards_count))
          : 0;
    if (body.photo_url !== undefined)
      updates.photo_url = isNonEmptyString(body.photo_url) ? body.photo_url : null;

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

/** DELETE /api/regattas/:id — elimina (regattas.delete). */
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

// Transiciones de estado permitidas.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['finished', 'cancelled'],
  finished: [],
  cancelled: [],
};

/** PUT /api/regattas/:id/status — cambia el estado (regattas.edit). */
router.put(
  '/:id/status',
  requireAuth,
  requirePermission('regattas.edit'),
  asyncHandler(async (req, res) => {
    const { status } = req.body ?? {};
    const valid = ['upcoming', 'open', 'in_progress', 'finished', 'cancelled'];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    if (status !== regatta.status) {
      const allowed = STATUS_TRANSITIONS[regatta.status] ?? [];
      if (!allowed.includes(status)) {
        return res.status(422).json({
          error: `No se puede pasar de "${regatta.status}" a "${status}"`,
        });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('regattas')
      .update({ status })
      .eq('id', regatta.id)
      .select(REGATTA_FIELDS)
      .single();
    if (error) throw error;
    return res.json({ regatta: data });
  })
);

// ============================================================
// ADMIN — mangas y resultados (regattas.manage_results)
// ============================================================

/** POST /api/regattas/:id/races — crea una manga. */
router.post(
  '/:id/races',
  requireAuth,
  requirePermission('regattas.manage_results'),
  asyncHandler(async (req, res) => {
    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    // race_number: el indicado o el siguiente disponible.
    let raceNumber = Number(req.body?.race_number);
    if (!Number.isFinite(raceNumber) || raceNumber <= 0) {
      const { data: last } = await supabaseAdmin
        .from('races')
        .select('race_number')
        .eq('regatta_id', regatta.id)
        .order('race_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      raceNumber = (last?.race_number ?? 0) + 1;
    }

    const { data, error } = await supabaseAdmin
      .from('races')
      .insert({
        regatta_id: regatta.id,
        race_number: Math.floor(raceNumber),
        name: isNonEmptyString(req.body?.name) ? req.body.name.trim() : null,
      })
      .select('id, race_number, name, status, sailed_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una manga con ese número' });
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
      .select('id')
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
 * PUT /api/regattas/races/:raceId/results — carga resultados en lote.
 * Body: { results: [{ entry_id, position, code? }] }. Calcula puntos
 * (Low Point) y marca la manga como completed.
 */
router.put(
  '/races/:raceId/results',
  requireAuth,
  requirePermission('regattas.manage_results'),
  asyncHandler(async (req, res) => {
    const { data: race } = await supabaseAdmin
      .from('races')
      .select('id, regatta_id')
      .eq('id', req.params.raceId)
      .maybeSingle();
    if (!race) {
      return res.status(404).json({ error: 'Manga no encontrada' });
    }

    const input = Array.isArray(req.body) ? req.body : req.body?.results;
    if (!Array.isArray(input)) {
      return res.status(400).json({ error: 'Se espera un array de resultados' });
    }

    // Inscriptos confirmados de la regata (para validar y para el puntaje).
    const { data: entries } = await supabaseAdmin
      .from('regatta_entries')
      .select('id')
      .eq('regatta_id', race.regatta_id)
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
          error: 'Un resultado no corresponde a un inscripto de esta regata',
        });
      }
      const code = isNonEmptyString(item?.code) ? item.code : null;
      let position: number | null = null;
      let points: number;

      if (code) {
        // Código especial: puntaje de penalización, sin posición.
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
          return res.status(422).json({
            error: `La posición ${position} está repetida`,
          });
        }
        seenPositions.add(position);
        points = position;
      }

      rows.push({
        race_id: race.id,
        entry_id: entryId,
        position,
        points,
        code,
      });
    }

    // Upsert de resultados (unique race_id, entry_id).
    const { error: upsertError } = await supabaseAdmin
      .from('race_results')
      .upsert(rows, { onConflict: 'race_id,entry_id' });
    if (upsertError) throw upsertError;

    // Marcar la manga como completada.
    const { error: raceError } = await supabaseAdmin
      .from('races')
      .update({ status: 'completed', sailed_at: new Date().toISOString() })
      .eq('id', race.id);
    if (raceError) throw raceError;

    return res.json({ updated: rows.length });
  })
);

// ============================================================
// INSCRIPCIÓN (usuarios)
// ============================================================

/** POST /api/regattas/:id/register — inscribe un barco del usuario. */
router.post(
  '/:id/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { boat_id, sail_number } = req.body ?? {};
    if (!isNonEmptyString(boat_id)) {
      return res.status(400).json({ error: 'Falta el barco (boat_id)' });
    }

    const { data: regatta } = await supabaseAdmin
      .from('regattas')
      .select(
        'id, sailing_class, status, max_entries, registration_opens_at, registration_closes_at'
      )
      .eq('id', req.params.id)
      .maybeSingle();
    if (!regatta) {
      return res.status(404).json({ error: 'Regata no encontrada' });
    }

    // 1. El estado permite inscripción.
    if (regatta.status !== 'open') {
      return res
        .status(422)
        .json({ error: 'Las inscripciones no están abiertas' });
    }

    // 2. Ventana de inscripción vigente.
    const now = Date.now();
    if (
      regatta.registration_opens_at &&
      now < new Date(regatta.registration_opens_at).getTime()
    ) {
      return res.status(422).json({ error: 'La inscripción todavía no abrió' });
    }
    if (
      regatta.registration_closes_at &&
      now > new Date(regatta.registration_closes_at).getTime()
    ) {
      return res.status(422).json({ error: 'La inscripción ya cerró' });
    }

    // 3. El barco pertenece al usuario.
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

    // 4. La clase coincide.
    if (boat.category !== regatta.sailing_class) {
      return res.status(422).json({
        error: `Tu barco es clase ${boat.category}, esta regata es para clase ${regatta.sailing_class}`,
      });
    }

    // 5. No inscripto ya (confirmado).
    const { data: existing } = await supabaseAdmin
      .from('regatta_entries')
      .select('id, status')
      .eq('regatta_id', regatta.id)
      .eq('boat_id', boat.id)
      .maybeSingle();
    if (existing && existing.status === 'confirmed') {
      return res.status(409).json({ error: 'Ese barco ya está inscripto' });
    }

    // 6. Hay cupo.
    if (regatta.max_entries != null) {
      const count = await confirmedCount(regatta.id);
      if (count >= regatta.max_entries) {
        return res.status(422).json({ error: 'La regata alcanzó su cupo' });
      }
    }

    const finalSail = isNonEmptyString(sail_number)
      ? sail_number.trim()
      : boat.sail_number;

    // Si existía una entry retirada, reactivarla; si no, crear.
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
          regatta_id: regatta.id,
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

/** DELETE /api/regattas/:id/register — retira la inscripción del usuario. */
router.delete(
  '/:id/register',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Busca una entry confirmada del usuario (que inscribió o es owner).
    const { data: entries } = await supabaseAdmin
      .from('regatta_entries')
      .select('id, registered_by, boat:boats(owner_id)')
      .eq('regatta_id', req.params.id)
      .eq('status', 'confirmed');

    const mine = (entries ?? []).find(
      (e) =>
        e.registered_by === req.user!.id ||
        (e.boat as { owner_id?: string } | null)?.owner_id === req.user!.id
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
