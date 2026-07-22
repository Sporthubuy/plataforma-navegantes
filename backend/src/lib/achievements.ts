/**
 * Sincronización de logros desde las regatas de la app.
 *
 * Vive acá y no en un trigger de Postgres porque la posición final sale
 * de `computeStandings` (Low Point + descartes + penalizaciones), que ya
 * está implementado y testeado en TypeScript. Duplicarlo en plpgsql
 * sería mantener dos veces el código más delicado del sistema.
 *
 * Se dispara cuando una CLASE queda `finished`: antes de eso la posición
 * cambia con cada manga y no hay logro que valga. Es idempotente: el
 * índice único (user_id, regatta_class_id) hace que recargar resultados
 * actualice la fila en vez de duplicarla.
 */

import { supabaseAdmin } from './supabase';
import { computeStandings } from './scoring';

type AchievementType =
  | '1st_place'
  | '2nd_place'
  | '3rd_place'
  | 'podium'
  | 'regatta_finished';

/** La posición final decide qué clase de logro es. */
function achievementForPosition(position: number): AchievementType {
  if (position === 1) return '1st_place';
  if (position === 2) return '2nd_place';
  if (position === 3) return '3rd_place';
  return 'regatta_finished';
}

interface SyncResult {
  synced: number;
  skipped?: string;
}

/**
 * Genera (o actualiza) los logros de todos los navegantes que corrieron
 * una clase ya terminada. Cuenta al dueño del barco y a su tripulación
 * aceptada: en un CV náutico el proa que ganó también ganó.
 */
export async function syncClassAchievements(
  regattaClassId: string
): Promise<SyncResult> {
  const { data: cls, error: clsError } = await supabaseAdmin
    .from('regatta_classes')
    .select(
      'id, sailing_class, discards_count, status, regatta:regattas(id, name, start_date, end_date)'
    )
    .eq('id', regattaClassId)
    .maybeSingle();

  if (clsError) throw clsError;
  if (!cls) return { synced: 0, skipped: 'clase inexistente' };
  if (cls.status !== 'finished') {
    return { synced: 0, skipped: 'la clase todavía no terminó' };
  }

  const regatta = cls.regatta as unknown as {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  } | null;
  if (!regatta) return { synced: 0, skipped: 'regata inexistente' };

  const [{ data: entries }, { data: races }, { count: seriesCount }] =
    await Promise.all([
      supabaseAdmin
        .from('regatta_entries')
        .select('id, boat_id, boat:boats(id, name, owner_id)')
        .eq('regatta_class_id', regattaClassId)
        .eq('status', 'confirmed'),
      supabaseAdmin
        .from('races')
        .select('id, race_number, status')
        .eq('regatta_class_id', regattaClassId),
      supabaseAdmin
        .from('regatta_entries')
        .select('id', { count: 'exact', head: true })
        .eq('regatta_class_id', regattaClassId),
    ]);

  const entryList = entries ?? [];
  const raceList = races ?? [];
  if (entryList.length === 0 || raceList.length === 0) {
    return { synced: 0, skipped: 'la clase no tiene inscriptos o mangas' };
  }

  const raceIds = raceList.map((r) => r.id);
  const { data: results } = await supabaseAdmin
    .from('race_results')
    .select('race_id, entry_id, position, code')
    .in('race_id', raceIds);

  const computed = computeStandings(
    entryList.map((e) => e.id),
    raceList,
    results ?? [],
    cls.discards_count,
    undefined,
    seriesCount ?? entryList.length
  );

  // Tripulación aceptada de cada barco: también corrió la regata.
  const boatIds = entryList.map((e) => e.boat_id);
  const { data: crew } = await supabaseAdmin
    .from('crew_members')
    .select('boat_id, user_id')
    .in('boat_id', boatIds)
    .eq('status', 'accepted');

  const crewByBoat = new Map<string, string[]>();
  for (const member of crew ?? []) {
    const list = crewByBoat.get(member.boat_id) ?? [];
    list.push(member.user_id);
    crewByBoat.set(member.boat_id, list);
  }

  const entryById = new Map(
    entryList.map((e) => [
      e.id,
      e as unknown as {
        id: string;
        boat_id: string;
        boat: { id: string; name: string; owner_id: string } | null;
      },
    ])
  );

  const totalEntries = computed.standings.length;
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (const standing of computed.standings) {
    const entry = entryById.get(standing.entry_id);
    if (!entry?.boat) continue;

    const sailors = [
      entry.boat.owner_id,
      ...(crewByBoat.get(entry.boat_id) ?? []),
    ];

    for (const userId of sailors) {
      // Un mismo usuario podría estar en dos barcos de la clase; el
      // índice único no lo permitiría y el upsert fallaría con la fila
      // duplicada en el mismo batch.
      if (seen.has(userId)) continue;
      seen.add(userId);

      rows.push({
        user_id: userId,
        achievement_type: achievementForPosition(standing.rank),
        regatta_id: regatta.id,
        regatta_class_id: cls.id,
        regatta_name: regatta.name,
        regatta_class: cls.sailing_class,
        regatta_date: regatta.end_date ?? regatta.start_date,
        position: standing.rank,
        total_entries: totalEntries,
        boat_name: entry.boat.name,
        is_manual: false,
      });
    }
  }

  if (rows.length === 0) return { synced: 0, skipped: 'nada que sincronizar' };

  const { error } = await supabaseAdmin
    .from('regatta_achievements')
    .upsert(rows, { onConflict: 'user_id,regatta_class_id' });

  if (error) throw error;
  return { synced: rows.length };
}

/**
 * Sincroniza todas las clases terminadas de un campeonato. Se usa al
 * cerrar la regata entera.
 */
export async function syncRegattaAchievements(regattaId: string) {
  const { data: classes } = await supabaseAdmin
    .from('regatta_classes')
    .select('id')
    .eq('regatta_id', regattaId)
    .eq('status', 'finished');

  let synced = 0;
  for (const cls of classes ?? []) {
    const result = await syncClassAchievements(cls.id);
    synced += result.synced;
  }
  return { synced };
}

/**
 * Envuelve la sincronización para llamarla desde una ruta sin que un
 * fallo tumbe la respuesta: cerrar la clase tiene que funcionar aunque
 * los logros no se hayan podido generar (se recalculan después).
 */
export function syncClassAchievementsSafely(regattaClassId: string): void {
  syncClassAchievements(regattaClassId).catch((error) => {
    console.error('No se pudieron sincronizar los logros:', error);
  });
}
