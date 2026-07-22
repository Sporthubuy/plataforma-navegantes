import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../lib/supabase';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../lib/async-handler';
import { isNonEmptyString } from '../lib/validation';
import { sanitizeLocation } from '../lib/location';
import {
  calculateMatchScore,
  locationsMatch,
  type ClassifiedRequirement,
  type ClassifiedRequirementType,
  type MatchingUserProfile,
} from '../lib/matching';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const REQUIREMENT_TYPES: ClassifiedRequirementType[] = [
  'sailing_class',
  'experience_level',
  'role',
  'language',
  'availability',
];
const CLASSIFIED_FIELDS =
  'id, author_id, category, title, description, country, city, location_worldwide, status, created_at, expires_at, renewed_at, views_count, contact_email, contact_phone';
const PROFILE_FIELDS =
  'id, username, name, avatar_url, sailing_class, usual_role, country, city, bio';

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

function parsePagination(query: Request['query']) {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);
  return {
    limit:
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT,
    offset:
      Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0,
  };
}

function escapedSearch(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function isRequirementType(value: unknown): value is ClassifiedRequirementType {
  return typeof value === 'string' && REQUIREMENT_TYPES.includes(value as ClassifiedRequirementType);
}

function parseRequirements(value: unknown):
  | { requirements: ClassifiedRequirement[] }
  | { error: string } {
  if (value === undefined) return { requirements: [] };
  if (!Array.isArray(value)) {
    return { error: 'requirements debe ser un array' };
  }

  const requirements: ClassifiedRequirement[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== 'object' ||
      !isRequirementType((item as Record<string, unknown>).requirement_type) ||
      !isNonEmptyString((item as Record<string, unknown>).requirement_value)
    ) {
      return {
        error:
          'Cada requisito necesita requirement_type válido y requirement_value',
      };
    }
    requirements.push({
      requirement_type: (item as Record<string, unknown>)
        .requirement_type as ClassifiedRequirementType,
      requirement_value: (
        (item as Record<string, unknown>).requirement_value as string
      ).trim(),
    });
  }

  const unique = new Set(
    requirements.map((r) => `${r.requirement_type}:${r.requirement_value.toLocaleLowerCase()}`)
  );
  if (unique.size !== requirements.length) {
    return { error: 'No se puede repetir el mismo requisito' };
  }
  return { requirements };
}

function requirementLabel(requirement: ClassifiedRequirement): string {
  return `${requirement.requirement_type}: ${requirement.requirement_value}`;
}

async function requirementsFor(classifiedIds: string[]) {
  const byClassified = new Map<string, ClassifiedRequirement[]>();
  if (classifiedIds.length === 0) return byClassified;
  const { data, error } = await supabaseAdmin
    .from('classified_requirements')
    .select('classified_id, requirement_type, requirement_value')
    .in('classified_id', classifiedIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const list = byClassified.get(row.classified_id) ?? [];
    list.push({
      requirement_type: row.requirement_type as ClassifiedRequirementType,
      requirement_value: row.requirement_value,
    });
    byClassified.set(row.classified_id, list);
  }
  return byClassified;
}

async function interestCounts(classifiedIds: string[]) {
  const counts = new Map<string, number>();
  if (classifiedIds.length === 0) return counts;
  const { data, error } = await supabaseAdmin
    .from('classified_interests')
    .select('classified_id')
    .in('classified_id', classifiedIds);
  if (error) throw error;
  for (const row of data ?? []) {
    counts.set(row.classified_id, (counts.get(row.classified_id) ?? 0) + 1);
  }
  return counts;
}

async function findOwnedClassified(
  id: string,
  userId: string,
  res: Response
) {
  const { data, error } = await supabaseAdmin
    .from('classifieds')
    .select(CLASSIFIED_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    res.status(404).json({ error: 'Clasificado no encontrado' });
    return null;
  }
  if (data.author_id !== userId) {
    res.status(403).json({ error: 'Solo el autor puede hacer esto' });
    return null;
  }
  return data;
}

async function enrichClassifieds(rows: Array<Record<string, unknown>>) {
  const ids = rows.map((row) => row.id as string);
  const [requirements, interests] = await Promise.all([
    requirementsFor(ids),
    interestCounts(ids),
  ]);
  return rows.map((row) => {
    const classifiedRequirements = requirements.get(row.id as string) ?? [];
    return {
      ...row,
      requirements: classifiedRequirements,
      requirement_count: classifiedRequirements.length,
      requirement_summary: classifiedRequirements.map(requirementLabel),
      interest_count: interests.get(row.id as string) ?? 0,
    };
  });
}

// ============================================================
// LECTURA PÚBLICA
// ============================================================

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const country =
      typeof req.query.country === 'string' ? req.query.country.trim().toUpperCase() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'recent';

    const { error: expirationError } = await supabaseAdmin.rpc('expire_classifieds');
    if (expirationError) throw expirationError;

    let query = supabaseAdmin
      .from('classifieds')
      .select(`${CLASSIFIED_FIELDS}, author:profiles(${PROFILE_FIELDS})`, { count: 'exact' })
      .eq('status', 'active');
    if (['tripulante', 'profesor', 'barco', 'otro'].includes(category)) {
      query = query.eq('category', category);
    }
    // Un aviso mundial aparece en cualquier búsqueda por ubicación.
    if (/^[A-Z]{2}$/.test(country)) {
      query = query.or(`country.eq.${country},location_worldwide.eq.true`);
    }
    if (city) {
      query = query.or(`city.eq.${city},location_worldwide.eq.true`);
    }
    if (search) {
      const pattern = `%${escapedSearch(search)}%`;
      query = query.or(`title.ilike.${pattern},description.ilike.${pattern}`);
    }

    const order = sort === 'views' ? 'views_count' : 'created_at';
    const result = await query
      .order(order, { ascending: false })
      .range(sort === 'score_desc' ? 0 : offset, sort === 'score_desc' ? 999999 : offset + limit - 1);
    const { data, error, count } = result;
    if (error) throw error;

    let rows = (data ?? []) as Array<Record<string, unknown>>;
    if (sort === 'score_desc' && rows.length > 0) {
      const ids = rows.map((row) => row.id as string);
      const { data: matches, error: matchesError } = await supabaseAdmin
        .from('classified_matches')
        .select('classified_id, match_score')
        .in('classified_id', ids);
      if (matchesError) throw matchesError;
      const scoreByClassified = new Map<string, number>();
      for (const match of matches ?? []) {
        scoreByClassified.set(
          match.classified_id,
          Math.max(scoreByClassified.get(match.classified_id) ?? 0, Number(match.match_score) || 0)
        );
      }
      rows = rows.sort(
        (left, right) =>
          (scoreByClassified.get(right.id as string) ?? 0) -
          (scoreByClassified.get(left.id as string) ?? 0)
      );
    }

    const total = count ?? 0;
    const paginatedRows = sort === 'score_desc' ? rows.slice(offset, offset + limit) : rows;
    const classifieds = await enrichClassifieds(paginatedRows);
    return res.json({
      classifieds,
      pagination: { limit, offset, total },
    });
  })
);

router.get(
  '/my-classifieds',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data, error } = await supabaseAdmin
      .from('classifieds')
      .select(CLASSIFIED_FIELDS)
      .eq('author_id', req.user!.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ classifieds: await enrichClassifieds((data ?? []) as Array<Record<string, unknown>>) });
  })
);

/**
 * GET /api/classifieds/matches/mine — requiere auth.
 * Clasificados que matchean con el perfil del usuario, de mayor a menor
 * score. Alimenta el widget de sugerencias de la home.
 */
router.get(
  '/matches/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const minScore = Number(req.query.min_score);
    const threshold = Number.isFinite(minScore) ? minScore : 50;
    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 5;

    const { data, error } = await supabaseAdmin
      .from('classified_matches')
      .select('id, classified_id, match_score, viewed_at, created_at')
      .eq('matched_user_id', req.user!.id)
      .gte('match_score', threshold)
      .order('match_score', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const rows = data ?? [];
    const ids = rows.map((m) => m.classified_id);
    if (ids.length === 0) return res.json({ matches: [] });

    // Solo se sugieren avisos vigentes.
    const { data: classifieds } = await supabaseAdmin
      .from('classifieds')
      .select(CLASSIFIED_FIELDS)
      .in('id', ids)
      .eq('status', 'active');

    const byId = new Map(
      ((classifieds ?? []) as Array<Record<string, unknown>>).map((c) => [
        c.id as string,
        c,
      ])
    );

    const matches = rows
      .filter((m) => byId.has(m.classified_id))
      .map((m) => ({
        ...m,
        classified: byId.get(m.classified_id),
      }));

    return res.json({ matches });
  })
);

router.get(
  '/:id/matches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    const { data, error } = await supabaseAdmin
      .from('classified_matches')
      .select(`id, classified_id, matched_user_id, match_score, created_at, viewed_at, user:profiles(${PROFILE_FIELDS})`)
      .eq('classified_id', classified.id)
      .order('match_score', { ascending: false });
    if (error) throw error;
    return res.json({ matches: data ?? [] });
  })
);

router.get(
  '/:id/interests',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    const { data, error } = await supabaseAdmin
      .from('classified_interests')
      .select(`id, classified_id, user_id, message, created_at, user:profiles(${PROFILE_FIELDS})`)
      .eq('classified_id', classified.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ interests: data ?? [] });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const userId = optionalUserId(req);
    const { data: classified, error } = await supabaseAdmin
      .from('classifieds')
      .select(`${CLASSIFIED_FIELDS}, author:profiles(${PROFILE_FIELDS})`)
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!classified) return res.status(404).json({ error: 'Clasificado no encontrado' });
    if (classified.status !== 'active' && classified.author_id !== userId) {
      return res.status(404).json({ error: 'Clasificado no encontrado' });
    }

    const [requirements, interestCount] = await Promise.all([
      requirementsFor([classified.id]),
      interestCounts([classified.id]),
    ]);
    const classifiedRequirements = requirements.get(classified.id) ?? [];
    let isInterested = false;
    let interests: unknown[] | undefined;
    if (userId) {
      const { data: ownInterest } = await supabaseAdmin
        .from('classified_interests')
        .select('id')
        .eq('classified_id', classified.id)
        .eq('user_id', userId)
        .maybeSingle();
      isInterested = Boolean(ownInterest);
    }
    if (userId === classified.author_id || isInterested) {
      const { data } = await supabaseAdmin
        .from('classified_interests')
        .select(`id, user_id, message, created_at, user:profiles(${PROFILE_FIELDS})`)
        .eq('classified_id', classified.id)
        .order('created_at', { ascending: false });
      interests = data ?? [];
    }

    return res.json({
      classified: {
        ...classified,
        requirements: classifiedRequirements,
        requirement_count: classifiedRequirements.length,
        interest_count: interestCount.get(classified.id) ?? 0,
        is_interested: isInterested,
        ...(interests ? { interests } : {}),
      },
    });
  })
);

// ============================================================
// ESCRITURA
// ============================================================

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const categories = ['tripulante', 'profesor', 'barco', 'otro'];
    if (!categories.includes(body.category)) return res.status(400).json({ error: 'Categoría inválida' });
    for (const field of ['title', 'description']) {
      if (!isNonEmptyString(body[field])) return res.status(400).json({ error: `${field} es obligatorio` });
    }

    const worldwide = body.location_worldwide === true;
    const location = await sanitizeLocation(body);
    if ('error' in location) {
      return res.status(location.error.status).json({ error: location.error.message });
    }
    // Si no es mundial, tiene que decir dónde es.
    if (!worldwide && !location.updates.country) {
      return res.status(400).json({ error: 'Elegí el país del aviso o marcalo como mundial' });
    }
    const parsed = parseRequirements(body.requirements);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });

    const { data: classified, error } = await supabaseAdmin
      .from('classifieds')
      .insert({
        author_id: req.user!.id,
        category: body.category,
        title: body.title.trim(),
        description: body.description.trim(),
        ...location.updates,
        location_worldwide: worldwide,
        contact_email: isNonEmptyString(body.contact_email) ? body.contact_email.trim() : null,
        contact_phone: isNonEmptyString(body.contact_phone) ? body.contact_phone.trim() : null,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select(`${CLASSIFIED_FIELDS}, author:profiles(${PROFILE_FIELDS})`)
      .single();
    if (error) throw error;

    if (parsed.requirements.length > 0) {
      const { error: requirementsError } = await supabaseAdmin
        .from('classified_requirements')
        .insert(parsed.requirements.map((requirement) => ({ classified_id: classified.id, ...requirement })));
      if (requirementsError) throw requirementsError;
    }
    return res.status(201).json({ classified: { ...classified, requirements: parsed.requirements } });
  })
);

router.put(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    if (classified.status !== 'active') return res.status(422).json({ error: 'Solo se puede editar un clasificado activo' });

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {};
    for (const field of ['title', 'description']) {
      if (body[field] !== undefined) {
        if (!isNonEmptyString(body[field])) return res.status(400).json({ error: `${field} no puede estar vacío` });
        updates[field] = body[field].trim();
      }
    }
    if (body.category !== undefined) {
      if (!['tripulante', 'profesor', 'barco', 'otro'].includes(body.category)) return res.status(400).json({ error: 'Categoría inválida' });
      updates.category = body.category;
    }
    for (const field of ['location_worldwide', 'contact_email', 'contact_phone']) {
      if (body[field] !== undefined) updates[field] = field === 'location_worldwide' ? body[field] === true : (isNonEmptyString(body[field]) ? body[field].trim() : null);
    }

    const location = await sanitizeLocation(body);
    if ('error' in location) {
      return res.status(location.error.status).json({ error: location.error.message });
    }
    Object.assign(updates, location.updates);

    // El CHECK de la base exige país salvo que el aviso sea mundial:
    // se valida contra el estado resultante, no solo contra el body.
    const finalWorldwide =
      updates.location_worldwide !== undefined
        ? updates.location_worldwide
        : classified.location_worldwide;
    const finalCountry =
      updates.country !== undefined ? updates.country : classified.country;
    if (!finalWorldwide && !finalCountry) {
      return res.status(400).json({ error: 'Elegí el país del aviso o marcalo como mundial' });
    }
    const parsed = parseRequirements(body.requirements);
    if ('error' in parsed) return res.status(400).json({ error: parsed.error });
    if (Object.keys(updates).length === 0 && body.requirements === undefined) return res.status(400).json({ error: 'No hay campos para actualizar' });

    let updated = classified;
    if (Object.keys(updates).length > 0) {
      const result = await supabaseAdmin.from('classifieds').update(updates).eq('id', classified.id).select(`${CLASSIFIED_FIELDS}, author:profiles(${PROFILE_FIELDS})`).single();
      if (result.error) throw result.error;
      updated = result.data;
    }
    if (body.requirements !== undefined) {
      const { error: deleteError } = await supabaseAdmin.from('classified_requirements').delete().eq('classified_id', classified.id);
      if (deleteError) throw deleteError;
      if (parsed.requirements.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('classified_requirements').insert(parsed.requirements.map((requirement) => ({ classified_id: classified.id, ...requirement })));
        if (insertError) throw insertError;
      }
    }
    return res.json({ classified: { ...updated, requirements: body.requirements === undefined ? await requirementsFor([classified.id]).then((map) => map.get(classified.id) ?? []) : parsed.requirements } });
  })
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    const { data, error } = await supabaseAdmin.from('classifieds').update({ status: 'archived' }).eq('id', classified.id).select(CLASSIFIED_FIELDS).single();
    if (error) throw error;
    return res.json({ classified: data });
  })
);

router.put(
  '/:id/renew',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    const expiresAt = new Date(classified.expires_at).getTime();
    const grace = 7 * 24 * 60 * 60 * 1000;
    if (!['active', 'expired'].includes(classified.status) || expiresAt < Date.now() - grace) {
      return res.status(422).json({ error: 'El clasificado no puede renovarse fuera del período de gracia' });
    }
    const { data, error } = await supabaseAdmin.from('classifieds').update({ status: 'active', expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), renewed_at: new Date().toISOString() }).eq('id', classified.id).select(CLASSIFIED_FIELDS).single();
    if (error) throw error;
    return res.json({ classified: data });
  })
);

router.get(
  '/:id/calculate-matches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const classified = await findOwnedClassified(req.params.id, req.user!.id, res);
    if (!classified) return;
    const requirementMap = await requirementsFor([classified.id]);
    const requirements = requirementMap.get(classified.id) ?? [];
    const { data: profiles, error: profilesError } = await supabaseAdmin.from('profiles').select(`${PROFILE_FIELDS}, status`).neq('id', classified.author_id).eq('status', 'active');
    if (profilesError) throw profilesError;
    const profileRows = profiles ?? [];
    const ids = profileRows.map((profile) => profile.id);
    const { data: boats } = ids.length
      ? await supabaseAdmin.from('boats').select('id, owner_id').in('owner_id', ids)
      : { data: [] };
    const boatIds = (boats ?? []).map((boat) => boat.id);
    const { data: entries } = boatIds.length
      ? await supabaseAdmin
          .from('regatta_entries')
          .select('boat_id, regatta_class:regatta_classes(status)')
          .in('boat_id', boatIds)
      : { data: [] };
    const boatCounts = new Map<string, number>();
    for (const boat of boats ?? []) boatCounts.set(boat.owner_id, (boatCounts.get(boat.owner_id) ?? 0) + 1);
    const boatOwners = new Map<string, string>();
    for (const boat of boats ?? []) boatOwners.set(boat.id, boat.owner_id);
    const finishedByUser = new Map<string, number>();
    const typedEntries = (entries ?? []) as unknown as Array<{
      boat_id: string;
      regatta_class: { status: string }[] | { status: string } | null;
    }>;
    for (const entry of typedEntries) {
      const regattaClass = Array.isArray(entry.regatta_class)
        ? entry.regatta_class[0]
        : entry.regatta_class;
      if (regattaClass?.status === 'finished') {
        const ownerId = boatOwners.get(entry.boat_id);
        if (ownerId) finishedByUser.set(ownerId, (finishedByUser.get(ownerId) ?? 0) + 1);
      }
    }
    const candidates = profileRows
      .filter(
        (profile) =>
          classified.location_worldwide ||
          locationsMatch(classified, profile)
      )
      .map((profile) => {
        const userProfile: MatchingUserProfile = {
          ...profile,
          boats_count: boatCounts.get(profile.id) ?? 0,
          finished_regattas_count: finishedByUser.get(profile.id) ?? 0,
          is_active: profile.status === 'active',
        };
        return { classified_id: classified.id, matched_user_id: profile.id, match_score: calculateMatchScore(requirements, userProfile) };
      })
      .filter((match) => match.match_score > 0);
    const { error: deleteError } = await supabaseAdmin.from('classified_matches').delete().eq('classified_id', classified.id);
    if (deleteError) throw deleteError;
    if (candidates.length > 0) {
      const { error: insertError } = await supabaseAdmin.from('classified_matches').insert(candidates);
      if (insertError) throw insertError;
    }
    const { data: matches, error } = await supabaseAdmin.from('classified_matches').select(`id, classified_id, matched_user_id, match_score, created_at, viewed_at, user:profiles(${PROFILE_FIELDS})`).eq('classified_id', classified.id).order('match_score', { ascending: false });
    if (error) throw error;
    return res.json({ matches: matches ?? [], calculated: candidates.length });
  })
);

router.post(
  '/:id/interest',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: classified, error: classifiedError } = await supabaseAdmin.from('classifieds').select('id, author_id, status').eq('id', req.params.id).maybeSingle();
    if (classifiedError) throw classifiedError;
    if (!classified || classified.status !== 'active') return res.status(404).json({ error: 'Clasificado activo no encontrado' });
    if (classified.author_id === req.user!.id) return res.status(422).json({ error: 'No puedes interesarte en tu propio clasificado' });
    const message = req.body?.message;
    const { data, error } = await supabaseAdmin.from('classified_interests').insert({ classified_id: classified.id, user_id: req.user!.id, message: isNonEmptyString(message) ? message.trim() : null }).select('id, classified_id, user_id, message, created_at').single();
    if (error?.code === '23505') return res.status(409).json({ error: 'Ya expresaste interés en este clasificado' });
    if (error) throw error;
    return res.status(201).json({ interest: data });
  })
);

router.delete(
  '/:id/interest',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { error } = await supabaseAdmin.from('classified_interests').delete().eq('classified_id', req.params.id).eq('user_id', req.user!.id);
    if (error) throw error;
    return res.status(204).send();
  })
);

router.put(
  '/matches/:matchId/view',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { data: match, error: matchError } = await supabaseAdmin.from('classified_matches').select('id, classified:classifieds(author_id)').eq('id', req.params.matchId).maybeSingle();
    if (matchError) throw matchError;
    if (!match) return res.status(404).json({ error: 'Match no encontrado' });
    const classified = match.classified as unknown as { author_id: string } | null;
    if (!classified || classified.author_id !== req.user!.id) return res.status(403).json({ error: 'Solo el autor puede marcar el match como visto' });
    const { data, error } = await supabaseAdmin.from('classified_matches').update({ viewed_at: new Date().toISOString() }).eq('id', match.id).select('id, viewed_at').single();
    if (error) throw error;
    return res.json({ match: data });
  })
);

export default router;