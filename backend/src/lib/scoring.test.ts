import { describe, it, expect } from 'vitest';
import {
  computeStandings,
  effectiveDiscards,
  penaltyPoints,
  pointsForResult,
  DEFAULT_DISCARD_THRESHOLD,
  type ScoringRace,
} from './scoring';

/** Helpers para armar el input de forma legible. */
const race = (n: number, status = 'completed'): ScoringRace => ({
  id: `r${n}`,
  race_number: n,
  status,
});
const res = (
  raceNum: number,
  entry: string,
  position: number | null,
  code: string | null = null
) => ({ race_id: `r${raceNum}`, entry_id: entry, position, code });

/** Devuelve [entry_id, total_neto] en orden de ranking. */
const ranking = (r: ReturnType<typeof computeStandings>) =>
  r.standings.map((s) => [s.entry_id, s.total] as const);

describe('penaltyPoints', () => {
  it('puntúa como cantidad de inscriptos + 1', () => {
    expect(penaltyPoints(3)).toBe(4);
    expect(penaltyPoints(10)).toBe(11);
    expect(penaltyPoints(0)).toBe(1);
  });
});

describe('pointsForResult', () => {
  it('usa la posición cuando el barco terminó', () => {
    expect(pointsForResult({ position: 1, code: null }, 5)).toBe(1);
    expect(pointsForResult({ position: 4, code: null }, 5)).toBe(4);
  });

  it('penaliza con inscriptos + 1 ante un código especial', () => {
    // 5 inscriptos -> DNF vale 6, sin importar la posición.
    expect(pointsForResult({ position: null, code: 'DNF' }, 5)).toBe(6);
    expect(pointsForResult({ position: 2, code: 'DSQ' }, 5)).toBe(6);
  });

  it('penaliza cuando no hay resultado cargado (DNC)', () => {
    expect(pointsForResult(undefined, 5)).toBe(6);
    expect(pointsForResult({ position: null, code: null }, 5)).toBe(6);
  });
});

describe('effectiveDiscards', () => {
  it('no descarta si no se alcanza el umbral', () => {
    // Umbral por defecto = 4 mangas completadas.
    expect(effectiveDiscards(1, 1)).toBe(0);
    expect(effectiveDiscards(1, 3)).toBe(0);
    expect(effectiveDiscards(2, 3)).toBe(0);
  });

  it('descarta al alcanzar el umbral', () => {
    expect(effectiveDiscards(1, 4)).toBe(1);
    expect(effectiveDiscards(1, 5)).toBe(1);
    expect(effectiveDiscards(2, 6)).toBe(2);
  });

  it('nunca descarta si discards_count es 0', () => {
    expect(effectiveDiscards(0, 10)).toBe(0);
  });

  it('nunca deja menos de una manga puntuando', () => {
    // 4 mangas, 9 descartes configurados -> como máximo 3.
    expect(effectiveDiscards(9, 4)).toBe(3);
  });

  it('respeta un umbral personalizado', () => {
    expect(effectiveDiscards(1, 2, 2)).toBe(1);
    expect(effectiveDiscards(1, 1, 2)).toBe(0);
  });

  it('el umbral por defecto es 4', () => {
    expect(DEFAULT_DISCARD_THRESHOLD).toBe(4);
  });
});

describe('computeStandings — Low Point básico', () => {
  it('gana quien menos puntos suma y el ranking queda ordenado', () => {
    // 3 barcos, 3 mangas, sin descartes.
    //   A: 1+2+1 = 4  -> 1º
    //   B: 2+1+2 = 5  -> 2º
    //   C: 3+3+3 = 9  -> 3º
    const r = computeStandings(
      ['A', 'B', 'C'],
      [race(1), race(2), race(3)],
      [
        res(1, 'A', 1), res(1, 'B', 2), res(1, 'C', 3),
        res(2, 'A', 2), res(2, 'B', 1), res(2, 'C', 3),
        res(3, 'A', 1), res(3, 'B', 2), res(3, 'C', 3),
      ]
    );

    expect(ranking(r)).toEqual([
      ['A', 4],
      ['B', 5],
      ['C', 9],
    ]);
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(r.completed_races).toBe(3);
    expect(r.effective_discards).toBe(0);
  });

  it('ignora las mangas que todavía no se corrieron (scheduled)', () => {
    // Solo la manga 1 está completada; la 2 está programada.
    //   A: 1 ; B: 2
    const r = computeStandings(
      ['A', 'B'],
      [race(1), race(2, 'scheduled')],
      [res(1, 'A', 1), res(1, 'B', 2), res(2, 'A', 2), res(2, 'B', 1)]
    );

    expect(r.completed_races).toBe(1);
    expect(r.standings[0].races).toHaveLength(1);
    expect(ranking(r)).toEqual([
      ['A', 1],
      ['B', 2],
    ]);
  });

  it('con una sola manga usa esa posición como total', () => {
    const r = computeStandings(
      ['A', 'B'],
      [race(1)],
      [res(1, 'A', 2), res(1, 'B', 1)]
    );

    expect(ranking(r)).toEqual([
      ['B', 1],
      ['A', 2],
    ]);
    expect(r.effective_discards).toBe(0);
  });

  it('sin mangas completadas devuelve totales en 0 y todos empatados', () => {
    const r = computeStandings(['A', 'B'], [race(1, 'scheduled')], []);

    expect(r.completed_races).toBe(0);
    expect(r.standings.every((s) => s.total === 0)).toBe(true);
    expect(r.standings.every((s) => s.races.length === 0)).toBe(true);
    // Todos con el mismo total comparten el puesto 1.
    expect(r.standings.map((s) => s.rank)).toEqual([1, 1]);
  });

  it('sin inscriptos devuelve una tabla vacía', () => {
    const r = computeStandings([], [race(1)], []);
    expect(r.standings).toEqual([]);
  });
});

describe('computeStandings — códigos especiales', () => {
  it('DNF/DNS/DSQ puntúan como inscriptos + 1', () => {
    // 3 inscriptos -> penalización = 4.
    //   A: 1 + 1 = 2
    //   B: 2 + DNF(4) = 6
    //   C: DSQ(4) + 2 = 6
    const r = computeStandings(
      ['A', 'B', 'C'],
      [race(1), race(2)],
      [
        res(1, 'A', 1), res(1, 'B', 2), res(1, 'C', null, 'DSQ'),
        res(2, 'A', 1), res(2, 'B', null, 'DNF'), res(2, 'C', 2),
      ]
    );

    const byId = Object.fromEntries(r.standings.map((s) => [s.entry_id, s]));
    expect(byId.A.total).toBe(2);
    expect(byId.B.total).toBe(6);
    expect(byId.C.total).toBe(6);
    // La penalización queda registrada con su código para mostrarla.
    expect(byId.B.races[1].code).toBe('DNF');
    expect(byId.B.races[1].points).toBe(4);
  });

  it('la penalización sale de los inscritos de la SERIE, no de los rankeados', () => {
    // 3 barcos inscritos, pero C se retiró: se rankean solo A y B.
    // El DNF de B debe seguir valiendo 3+1 = 4, no 2+1 = 3.
    const r = computeStandings(
      ['A', 'B'],
      [race(1)],
      [res(1, 'A', 1), res(1, 'B', null, 'DNF')],
      0,
      undefined,
      3 // inscritos en la serie
    );

    const byId = Object.fromEntries(r.standings.map((s) => [s.entry_id, s]));
    expect(byId.B.total).toBe(4);
    expect(r.series_entries).toBe(3);
    expect(r.penalty_points).toBe(4);
  });

  it('un retiro NO cambia el puntaje de los DNF ya corridos', () => {
    const races = [race(1)];
    const results = [res(1, 'A', 1), res(1, 'B', null, 'DNF')];

    // Antes del retiro: 3 inscritos, DNF = 4.
    const antes = computeStandings(['A', 'B', 'C'], races, results, 0, undefined, 3);
    // Después de que C se retira: se rankean 2, pero la serie sigue en 3.
    const despues = computeStandings(['A', 'B'], races, results, 0, undefined, 3);

    const dnfAntes = antes.standings.find((s) => s.entry_id === 'B')!.total;
    const dnfDespues = despues.standings.find((s) => s.entry_id === 'B')!.total;

    expect(dnfAntes).toBe(4);
    expect(dnfDespues).toBe(4); // estable
    expect(despues.penalty_points).toBe(antes.penalty_points);
  });

  it('sin seriesEntries usa la cantidad de rankeados (retrocompatible)', () => {
    const r = computeStandings(
      ['A', 'B'],
      [race(1)],
      [res(1, 'A', 1), res(1, 'B', null, 'DNF')]
    );
    expect(r.series_entries).toBe(2);
    expect(r.penalty_points).toBe(3);
  });

  it('una manga completada sin resultado cargado puntúa como DNC', () => {
    // 2 inscriptos -> penalización = 3. B no tiene resultado en la manga 2.
    //   A: 1 + 1 = 2 ; B: 2 + DNC(3) = 5
    const r = computeStandings(
      ['A', 'B'],
      [race(1), race(2)],
      [res(1, 'A', 1), res(1, 'B', 2), res(2, 'A', 1)]
    );

    const byId = Object.fromEntries(r.standings.map((s) => [s.entry_id, s]));
    expect(byId.B.races[1].points).toBe(3);
    expect(byId.B.total).toBe(5);
  });
});

describe('computeStandings — descartes', () => {
  // Escenario real verificado: 3 barcos, 5 mangas, 1 descarte.
  const entries = ['A', 'B', 'C'];
  const races = [race(1), race(2), race(3), race(4), race(5)];
  const results = [
    res(1, 'A', 1), res(1, 'B', 2), res(1, 'C', 3),
    res(2, 'A', 1), res(2, 'B', 3), res(2, 'C', 2),
    res(3, 'A', 2), res(3, 'B', 1), res(3, 'C', 3),
    res(4, 'A', 1), res(4, 'B', 2), res(4, 'C', 3),
    res(5, 'A', 3), res(5, 'B', 1), res(5, 'C', 2),
  ];

  it('descarta la peor manga de cada barco y calcula el neto', () => {
    //   A: 1,1,2,1,3 -> bruto 8, descarta 3 -> neto 5
    //   B: 2,3,1,2,1 -> bruto 9, descarta 3 -> neto 6
    //   C: 3,2,3,3,2 -> bruto 13, descarta 3 -> neto 10
    const r = computeStandings(entries, races, results, 1);

    expect(r.effective_discards).toBe(1);
    expect(ranking(r)).toEqual([
      ['A', 5],
      ['B', 6],
      ['C', 10],
    ]);

    const byId = Object.fromEntries(r.standings.map((s) => [s.entry_id, s]));
    expect(byId.A.gross_total).toBe(8);
    expect(byId.B.gross_total).toBe(9);
    expect(byId.C.gross_total).toBe(13);
  });

  it('marca exactamente una manga como descartada por barco', () => {
    const r = computeStandings(entries, races, results, 1);
    for (const s of r.standings) {
      expect(s.races.filter((rp) => rp.discarded)).toHaveLength(1);
    }
  });

  it('descarta la manga de MAYOR puntaje', () => {
    const r = computeStandings(entries, races, results, 1);
    const a = r.standings.find((s) => s.entry_id === 'A')!;
    const descartada = a.races.find((rp) => rp.discarded)!;
    // El peor resultado de A es el 3 de la manga 5.
    expect(descartada.points).toBe(3);
    expect(descartada.race_number).toBe(5);
  });

  it('NO descarta si no se alcanza el umbral, aunque discards_count > 0', () => {
    // Solo 3 mangas (umbral 4): el neto debe ser igual al bruto.
    //   A: 1+1+2 = 4 ; B: 2+3+1 = 6 ; C: 3+2+3 = 8
    const r = computeStandings(
      entries,
      races.slice(0, 3),
      results.slice(0, 9),
      1
    );

    expect(r.completed_races).toBe(3);
    expect(r.effective_discards).toBe(0);
    expect(r.standings.every((s) => s.total === s.gross_total)).toBe(true);
    expect(r.standings.every((s) => s.races.every((rp) => !rp.discarded))).toBe(
      true
    );
    expect(ranking(r)).toEqual([
      ['A', 4],
      ['B', 6],
      ['C', 8],
    ]);
  });

  it('expone la configuración de descartes usada', () => {
    const r = computeStandings(entries, races, results, 2);
    expect(r.discards_count).toBe(2);
    expect(r.discard_threshold).toBe(DEFAULT_DISCARD_THRESHOLD);
    expect(r.effective_discards).toBe(2);
  });

  it('un descarte puede cambiar el ganador', () => {
    // 4 mangas, 1 descarte.
    //   A: 1,1,1,8 -> bruto 11, descarta 8 -> neto 3
    //   B: 2,2,2,2 -> bruto 8,  descarta 2 -> neto 6
    // Sin descartes ganaría B (8 < 11); con descartes gana A (3 < 6).
    const r4 = [race(1), race(2), race(3), race(4)];
    const rs = [
      res(1, 'A', 1), res(1, 'B', 2),
      res(2, 'A', 1), res(2, 'B', 2),
      res(3, 'A', 1), res(3, 'B', 2),
      res(4, 'A', 8), res(4, 'B', 2),
    ];

    const sinDescarte = computeStandings(['A', 'B'], r4, rs, 0);
    expect(ranking(sinDescarte)).toEqual([
      ['B', 8],
      ['A', 11],
    ]);

    const conDescarte = computeStandings(['A', 'B'], r4, rs, 1);
    expect(ranking(conDescarte)).toEqual([
      ['A', 3],
      ['B', 6],
    ]);
  });
});

describe('computeStandings — desempates (World Sailing A8)', () => {
  it('A8.1: a igual total gana quien tenga más primeros', () => {
    // 2 mangas, sin descartes.
    //   A: 1+3 = 4 (un 1º)
    //   B: 2+2 = 4 (ningún 1º)
    // Empatan en 4 -> gana A por tener un primero.
    const r = computeStandings(
      ['A', 'B'],
      [race(1), race(2)],
      [res(1, 'A', 1), res(1, 'B', 2), res(2, 'A', 3), res(2, 'B', 2)]
    );

    expect(ranking(r)).toEqual([
      ['A', 4],
      ['B', 4],
    ]);
    expect(r.standings[0].entry_id).toBe('A');
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2]);
  });

  it('A8.1: sin primeros, desempata por cantidad de segundos', () => {
    // 4 barcos, 2 mangas.
    //   C: 1+2 = 3  -> 1º
    //   D: 4+1 = 5  -> 2º
    //   A: 2+4 = 6  (un 2º)   -> 3º por tener un segundo
    //   B: 3+3 = 6  (ningún 2º) -> 4º
    const r = computeStandings(
      ['A', 'B', 'C', 'D'],
      [race(1), race(2)],
      [
        res(1, 'A', 2), res(1, 'B', 3), res(1, 'C', 1), res(1, 'D', 4),
        res(2, 'A', 4), res(2, 'B', 3), res(2, 'C', 2), res(2, 'D', 1),
      ]
    );

    expect(ranking(r)).toEqual([
      ['C', 3],
      ['D', 5],
      ['A', 6],
      ['B', 6],
    ]);
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
  });

  it('A8.2: si persiste el empate, decide la última manga', () => {
    // 2 mangas.
    //   A: 2+3 = 5 (un 2º, un 3º)
    //   B: 3+2 = 5 (un 3º, un 2º)  -> mismo conteo de posiciones
    // Desempata la última manga: B hizo 2 y A hizo 3 -> gana B.
    const r = computeStandings(
      ['A', 'B'],
      [race(1), race(2)],
      [res(1, 'A', 2), res(1, 'B', 3), res(2, 'A', 3), res(2, 'B', 2)]
    );

    expect(r.standings[0].entry_id).toBe('B');
    expect(r.standings.map((s) => s.rank)).toEqual([1, 2]);
  });

  it('empate irresoluble: comparten el mismo puesto', () => {
    // Resultados idénticos -> mismo total, mismo conteo, misma última manga.
    const r = computeStandings(
      ['A', 'B'],
      [race(1)],
      [res(1, 'A', 1), res(1, 'B', 1)]
    );

    expect(r.standings.map((s) => s.rank)).toEqual([1, 1]);
  });
});
