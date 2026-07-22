/**
 * Buscador de talento: encontrar tripulantes y entrenadores.
 *
 * Es la base sobre la que después se apoyan seguimiento, mensajería y
 * recomendaciones, así que devuelve el perfil ya listo para pintar una
 * tarjeta (avatar, headline, especialidades, sello y experiencia) sin
 * que el frontend tenga que pedir nada más.
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** Qué `seeking_role` responde a cada búsqueda. `ambos` entra siempre. */
const ROLE_MATCHES: Record<string, string[]> = {
  tripulante: ['tripulante', 'ambos'],
  entrenador: ['entrenador', 'ambos'],
  socio_de_regata: ['socio_de_regata', 'ambos'],
};

/**
 * GET /api/search — público.
 * ?type=tripulante|entrenador|socio_de_regata
 * ?class=ILCA          (especialidad o clase preferida)
 * ?availability=available|selective|not_available
 * ?country=UY&city=Montevideo
 * ?verified=true       (solo perfiles con sello)
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const str = (key: string) =>
      typeof req.query[key] === 'string' ? (req.query[key] as string).trim() : '';

    const type = str('type');
    const sailingClass = str('class');
    const availability = str('availability');
    const country = str('country').toUpperCase();
    const city = str('city');
    const onlyVerified = str('verified') === 'true';

    const rawLimit = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
        : DEFAULT_LIMIT;
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

    // Se parte del resumen profesional: sin él, el navegante no se
    // ofreció para nada y no debería aparecer en una búsqueda.
    let query = supabaseAdmin
      .from('professional_summary')
      .select(
        'user_id, headline, specialties, preferred_classes, experience_years, seeking_role, availability_status'
      );

    const roles = ROLE_MATCHES[type];
    if (roles) query = query.in('seeking_role', roles);
    if (['available', 'selective', 'not_available'].includes(availability)) {
      query = query.eq('availability_status', availability);
    }
    if (sailingClass) {
      // Vale tanto como especialidad declarada como clase preferida.
      query = query.or(
        `specialties.cs.{"${sailingClass}"},preferred_classes.cs.{"${sailingClass}"}`
      );
    }

    const { data: summaries, error } = await query;
    if (error) throw error;
    if (!summaries || summaries.length === 0) {
      return res.json({ results: [], pagination: { limit, offset, total: 0 } });
    }

    // Solo perfiles públicos, y con el filtro geográfico aplicado.
    let profileQuery = supabaseAdmin
      .from('profiles')
      .select(
        'id, username, name, avatar_url, country, city, verified_badge, club:clubs!profiles_club_id_fkey(id, name, short_name)'
      )
      .in(
        'id',
        summaries.map((s) => s.user_id)
      )
      .eq('public_profile', true)
      .eq('status', 'active');

    if (/^[A-Z]{2}$/.test(country)) profileQuery = profileQuery.eq('country', country);
    if (city) profileQuery = profileQuery.eq('city', city);
    if (onlyVerified) profileQuery = profileQuery.eq('verified_badge', true);

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    if (profileById.size === 0) {
      return res.json({ results: [], pagination: { limit, offset, total: 0 } });
    }

    const { data: stats } = await supabaseAdmin
      .from('achievement_stats')
      .select(
        'user_id, total_regattas_sailed, total_1st_places, total_podiums, best_class, sailing_since_year, verified_credentials_count'
      )
      .in('user_id', [...profileById.keys()]);

    const statsByUser = new Map((stats ?? []).map((s) => [s.user_id, s]));

    const results = summaries
      .filter((s) => profileById.has(s.user_id))
      .map((s) => ({
        profile: profileById.get(s.user_id),
        professional_summary: s,
        achievement_stats: statsByUser.get(s.user_id) ?? {
          user_id: s.user_id,
          total_regattas_sailed: 0,
          total_1st_places: 0,
          total_podiums: 0,
          best_class: null,
          sailing_since_year: null,
          verified_credentials_count: 0,
        },
      }))
      // Primero los verificados, después los más rodados: quien busca
      // tripulación quiere ver arriba a quien ya navegó.
      .sort((a, b) => {
        const verified =
          Number(b.profile?.verified_badge ?? false) -
          Number(a.profile?.verified_badge ?? false);
        if (verified !== 0) return verified;
        const sailed =
          b.achievement_stats.total_regattas_sailed -
          a.achievement_stats.total_regattas_sailed;
        if (sailed !== 0) return sailed;
        return b.achievement_stats.total_podiums - a.achievement_stats.total_podiums;
      });

    return res.json({
      results: results.slice(offset, offset + limit),
      pagination: { limit, offset, total: results.length },
    });
  })
);

export default router;
