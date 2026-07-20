/**
 * Low Point System (World Sailing RRS Apéndice A).
 *
 * - Cada manga: los puntos de un barco son su posición de llegada
 *   (1º = 1 pt, 2º = 2 pts, …). Gana quien MENOS suma.
 * - Códigos especiales (DNF, DNS, DSQ, DNC, OCS, RET) y las mangas
 *   completadas sin resultado puntúan como `nInscriptos + 1` (A9/A5.2).
 * - El total es la suma de las mangas, restando los `discardsCount`
 *   peores resultados (descartes; 0 = ninguno).
 * - Desempates (A8): a igualdad de total, gana quien tenga más 1ros;
 *   si persiste, más 2dos, etc. (A8.1). Si aún hay empate, se compara
 *   el resultado de la última manga, luego la anterior, etc. (A8.2).
 */

export const SPECIAL_CODES = ['DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET'] as const;
export type SpecialCode = (typeof SPECIAL_CODES)[number];

export interface ScoringResult {
  entry_id: string;
  position: number | null;
  code: string | null;
}

export interface ScoringRace {
  id: string;
  race_number: number;
  status: string;
}

/**
 * Puntos de penalización estándar: cantidad de inscriptos + 1.
 * Se usa para códigos especiales y para mangas completadas sin resultado.
 */
export function penaltyPoints(entriesCount: number): number {
  return entriesCount + 1;
}

/**
 * Puntos de un resultado individual bajo Low Point.
 * Si trae código especial → penalización; si no, la posición.
 */
export function pointsForResult(
  result: { position: number | null; code: string | null } | undefined,
  entriesCount: number,
  raceCompleted: boolean
): number {
  if (!result || result.code) {
    // Sin resultado en manga completada = DNC; o código especial.
    return raceCompleted || result?.code ? penaltyPoints(entriesCount) : 0;
  }
  if (result.position == null) return 0;
  return result.position;
}

export interface StandingRacePoint {
  race_id: string;
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
  /** Conteo de posiciones (índice 0 = cantidad de 1ros, etc.) para desempate. */
  finishes: number[];
}

/**
 * Calcula la tabla general de una regata.
 *
 * @param entryIds  inscriptos considerados (confirmados).
 * @param races     mangas de la regata.
 * @param results   resultados cargados (race_id + entry_id + position/code).
 * @param discardsCount  cuántas peores mangas se descartan.
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
  discardsCount = 0
): Standing[] {
  const entriesCount = entryIds.length;
  const completedRaces = races.filter((r) => r.status === 'completed');

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
      const points = pointsForResult(result, entriesCount, true);
      return {
        race_id: race.id,
        points,
        position: result?.position ?? null,
        code: result?.code ?? null,
        discarded: false,
      };
    });

    // Descartes: marcar las `discardsCount` mangas de mayor puntaje.
    if (discardsCount > 0 && racePoints.length > discardsCount) {
      const order = [...racePoints]
        .map((rp, i) => ({ i, points: rp.points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, discardsCount);
      for (const { i } of order) racePoints[i].discarded = true;
    }

    const gross = racePoints.reduce((s, rp) => s + rp.points, 0);
    const net = racePoints
      .filter((rp) => !rp.discarded)
      .reduce((s, rp) => s + rp.points, 0);

    // Conteo de posiciones reales (para desempate A8.1).
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

  // Orden: menor total; desempates A8.
  standings.sort((a, b) => compareStandings(a, b, completedRaces));

  // Asignar rank (empates comparten número).
  standings.forEach((s, i) => {
    if (i > 0 && compareStandings(standings[i - 1], s, completedRaces) === 0) {
      s.rank = standings[i - 1].rank;
    } else {
      s.rank = i + 1;
    }
  });

  return standings;
}

/** Compara dos filas: total, luego A8.1 (más 1ros…), luego A8.2 (última manga). */
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
    if (av !== bv) return bv - av; // más de esa posición = mejor
  }

  // A8.2 — comparar el resultado de la última manga, luego la anterior…
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
