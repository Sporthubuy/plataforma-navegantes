/**
 * Low Point System (World Sailing RRS Apéndice A) — por CLASE de regata.
 *
 * - Cada manga: los puntos de un barco son su posición de llegada
 *   (1º = 1 pt, 2º = 2 pts, …). Gana quien MENOS suma.
 * - Códigos especiales (DNF, DNS, DSQ, DNC, OCS, RET) y las mangas
 *   completadas sin resultado puntúan como `nInscriptos + 1` (A9/A5.2).
 *
 * DESCARTES (por clase, `discards_count`):
 * - Se descartan las N peores mangas de cada barco (las de MAYOR puntaje).
 * - Regla de activación: el primer descarte recién cuenta a partir de
 *   `discardThreshold` mangas COMPLETADAS (default 4). Con menos mangas
 *   no se descarta nada aunque `discardsCount > 0`.
 * - Nunca se descartan tantas mangas como para dejar 0 puntuando: el
 *   máximo efectivo es `completadas - 1`.
 * - Se expone el total BRUTO (todas las mangas) y el NETO (con descartes),
 *   y qué mangas quedaron descartadas por barco (para marcarlas en la UI).
 *
 * DESEMPATES (A8): a igual total neto gana quien tenga más 1ros; si
 * persiste, más 2dos, etc. (A8.1). Si aún hay empate, se compara el
 * resultado de la última manga, luego la anterior (A8.2).
 */

export const SPECIAL_CODES = ['DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET'] as const;
export type SpecialCode = (typeof SPECIAL_CODES)[number];

/** Mangas completadas necesarias para que aplique el primer descarte. */
export const DEFAULT_DISCARD_THRESHOLD = 4;

export interface ScoringRace {
  id: string;
  race_number: number;
  status: string;
}

/** Puntos de penalización estándar: cantidad de inscriptos + 1. */
export function penaltyPoints(entriesCount: number): number {
  return entriesCount + 1;
}

/**
 * Cuántos descartes se aplican realmente.
 * 0 si no se alcanzó el umbral; nunca más que `completadas - 1`.
 */
export function effectiveDiscards(
  discardsCount: number,
  completedRaces: number,
  threshold: number = DEFAULT_DISCARD_THRESHOLD
): number {
  if (discardsCount <= 0) return 0;
  if (completedRaces < threshold) return 0;
  return Math.min(discardsCount, Math.max(0, completedRaces - 1));
}

/** Puntos de un resultado individual bajo Low Point. */
export function pointsForResult(
  result: { position: number | null; code: string | null } | undefined,
  entriesCount: number
): number {
  // Sin resultado en manga completada = DNC; o código especial.
  if (!result || result.code) return penaltyPoints(entriesCount);
  if (result.position == null) return penaltyPoints(entriesCount);
  return result.position;
}

export interface StandingRacePoint {
  race_id: string;
  race_number: number;
  points: number;
  position: number | null;
  code: string | null;
  discarded: boolean;
}

export interface Standing {
  entry_id: string;
  races: StandingRacePoint[];
  gross_total: number;
  total: number; // neto (con descartes aplicados)
  rank: number;
  /** Conteo de posiciones (índice 0 = cantidad de 1ros) para desempate. */
  finishes: number[];
}

export interface StandingsResult {
  standings: Standing[];
  /** Descartes realmente aplicados (0 si no se alcanzó el umbral). */
  effective_discards: number;
  completed_races: number;
  discards_count: number;
  discard_threshold: number;
  /** Barcos inscritos en la serie: base del puntaje de penalización. */
  series_entries: number;
  /** Puntos que vale un DNF/DSQ/etc. en esta clase (serie + 1). */
  penalty_points: number;
}

/**
 * Calcula la tabla general de UNA clase de regata.
 *
 * @param entryIds       inscriptos que se rankean (confirmados).
 * @param races          mangas de la clase.
 * @param results        resultados cargados.
 * @param discardsCount  descartes configurados en la clase.
 * @param threshold      mangas completadas para activar el 1er descarte.
 * @param seriesEntries  barcos INSCRITOS EN LA SERIE, base de la
 *   penalización (RRS A9/A5.2). Incluye a los que después se
 *   retiraron: si se contaran solo los confirmados, un retiro
 *   cambiaría retroactivamente el DNF de todos los demás.
 *   Por defecto, la cantidad de `entryIds`.
 */
export function computeStandings(
  entryIds: string[],
  races: ScoringRace[],
  results: Array<{
    race_id: string;
    entry_id: string;
    position: number | null;
    code: string | null;
  }>,
  discardsCount = 0,
  threshold: number = DEFAULT_DISCARD_THRESHOLD,
  seriesEntries?: number
): StandingsResult {
  const entriesCount = seriesEntries ?? entryIds.length;
  const completedRaces = races
    .filter((r) => r.status === 'completed')
    .sort((a, b) => a.race_number - b.race_number);

  const discards = effectiveDiscards(
    discardsCount,
    completedRaces.length,
    threshold
  );

  // Índice rápido de resultados por (race_id, entry_id).
  const byKey = new Map<string, { position: number | null; code: string | null }>();
  for (const r of results) {
    byKey.set(`${r.race_id}:${r.entry_id}`, {
      position: r.position,
      code: r.code,
    });
  }

  const standings: Standing[] = entryIds.map((entryId) => {
    const racePoints: StandingRacePoint[] = completedRaces.map((race) => {
      const result = byKey.get(`${race.id}:${entryId}`);
      return {
        race_id: race.id,
        race_number: race.race_number,
        points: pointsForResult(result, entriesCount),
        position: result?.position ?? null,
        code: result?.code ?? null,
        discarded: false,
      };
    });

    // Descartar las peores (mayor puntaje). Ante empate de puntos,
    // descarta la manga más tardía (criterio estable y habitual).
    if (discards > 0) {
      [...racePoints]
        .map((rp, i) => ({ i, points: rp.points, n: rp.race_number }))
        .sort((a, b) => b.points - a.points || b.n - a.n)
        .slice(0, discards)
        .forEach(({ i }) => {
          racePoints[i].discarded = true;
        });
    }

    const gross = racePoints.reduce((s, rp) => s + rp.points, 0);
    const net = racePoints
      .filter((rp) => !rp.discarded)
      .reduce((s, rp) => s + rp.points, 0);

    // Conteo de posiciones reales (desempate A8.1).
    const finishes: number[] = [];
    for (const rp of racePoints) {
      if (rp.position != null) {
        finishes[rp.position - 1] = (finishes[rp.position - 1] ?? 0) + 1;
      }
    }

    return {
      entry_id: entryId,
      races: racePoints,
      gross_total: gross,
      total: net,
      rank: 0,
      finishes,
    };
  });

  standings.sort((a, b) => compareStandings(a, b, completedRaces));

  standings.forEach((s, i) => {
    if (i > 0 && compareStandings(standings[i - 1], s, completedRaces) === 0) {
      s.rank = standings[i - 1].rank;
    } else {
      s.rank = i + 1;
    }
  });

  return {
    standings,
    effective_discards: discards,
    completed_races: completedRaces.length,
    discards_count: discardsCount,
    discard_threshold: threshold,
    series_entries: entriesCount,
    penalty_points: penaltyPoints(entriesCount),
  };
}

/** Compara dos filas: total neto, luego A8.1 (más 1ros…), luego A8.2. */
function compareStandings(
  a: Standing,
  b: Standing,
  completedRaces: ScoringRace[]
): number {
  if (a.total !== b.total) return a.total - b.total;

  // A8.1 — más primeros, luego más segundos, etc.
  const maxLen = Math.max(a.finishes.length, b.finishes.length);
  for (let i = 0; i < maxLen; i++) {
    const av = a.finishes[i] ?? 0;
    const bv = b.finishes[i] ?? 0;
    if (av !== bv) return bv - av;
  }

  // A8.2 — comparar la última manga, luego la anterior…
  const racesDesc = [...completedRaces].sort(
    (r1, r2) => r2.race_number - r1.race_number
  );
  for (const race of racesDesc) {
    const ap = a.races.find((rp) => rp.race_id === race.id)?.points ?? Infinity;
    const bp = b.races.find((rp) => rp.race_id === race.id)?.points ?? Infinity;
    if (ap !== bp) return ap - bp;
  }

  return 0;
}
