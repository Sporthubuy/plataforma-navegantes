'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Undo2 } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import type { Race, RegattaEntry } from '@/lib/types';

export const RESULT_CODES = ['DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET'];

type Mode = 'finish' | 'write' | 'reorder';

interface Row {
  entry_id: string;
  name: string;
  sail_number: string | null;
  position: string;
  code: string;
}

/** Clave del borrador local de una manga. */
function draftKey(raceId: string): string {
  return `navegantes_race_draft_${raceId}`;
}

/**
 * Estado inicial de la manga: lo que hay en el servidor, pisado por el
 * borrador local si existe (es trabajo más reciente que no se pudo
 * guardar todavía).
 */
function buildInitialRows(
  raceId: string,
  entries: RegattaEntry[],
  existing: Map<string, { position: number | null; code: string | null }>
): { rows: Row[]; restoredDraft: boolean } {
  const fromServer: Row[] = entries.map((e) => {
    const r = existing.get(e.id);
    return {
      entry_id: e.id,
      name: e.boat?.name ?? '—',
      sail_number: e.sail_number,
      position: r?.position != null ? String(r.position) : '',
      code: r?.code ?? '',
    };
  });

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(draftKey(raceId));
      if (raw) {
        const draft = JSON.parse(raw) as Record<
          string,
          { position: string; code: string }
        >;
        const merged = fromServer.map((r) =>
          draft[r.entry_id] ? { ...r, ...draft[r.entry_id] } : r
        );
        return { rows: sortByPosition(merged), restoredDraft: true };
      }
    } catch {
      // Un borrador corrupto no debe impedir cargar la manga.
    }
  }

  return { rows: sortByPosition(fromServer), restoredDraft: false };
}

/** Con posiciones cargadas, se muestran en orden de llegada. */
function sortByPosition(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => {
    const pa = a.position ? Number(a.position) : Number.MAX_SAFE_INTEGER;
    const pb = b.position ? Number(b.position) : Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });
}

/**
 * Carga de resultados de una manga. Tres modos:
 *
 * - "llegada": se toca cada barco en el orden en que cruza. Es como se
 *   trabaja de verdad en la lancha del comité, así que es el default.
 * - "escribir": un input de posición por barco, para transcribir una
 *   planilla ya hecha.
 * - "ordenar": se reordena la lista y la posición se numera sola.
 *
 * En los tres, cada barco puede llevar un código (DNF, DSQ…) en vez de
 * posición. Lo cargado se guarda en el navegador: si se corta la señal
 * en el agua, no se pierde.
 */
export function RaceResultsEditor({
  race,
  entries,
  existing,
  onSaved,
}: {
  race: Race;
  entries: RegattaEntry[];
  existing: Map<string, { position: number | null; code: string | null }>;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>('finish');
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  // Se resuelve junto con las filas: saber si hubo borrador es parte de
  // construir el estado inicial, no un efecto posterior.
  const [initial] = useState(() => buildInitialRows(race.id, entries, existing));
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [restoredDraft, setRestoredDraft] = useState(initial.restoredDraft);

  // Cada cambio se persiste: si se corta la señal, no se pierde.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft: Record<string, { position: string; code: string }> = {};
    for (const r of rows) {
      if (r.position || r.code) {
        draft[r.entry_id] = { position: r.position, code: r.code };
      }
    }
    if (Object.keys(draft).length === 0) {
      localStorage.removeItem(draftKey(race.id));
    } else {
      localStorage.setItem(draftKey(race.id), JSON.stringify(draft));
    }
  }, [rows, race.id]);

  /** Posiciones repetidas (solo en modo escribir). */
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (r.code || !r.position) continue;
      seen.set(r.position, (seen.get(r.position) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p));
  }, [rows]);

  /** Barcos sin posición ni código: el comité tiene que resolverlos. */
  const missing = useMemo(
    () => rows.filter((r) => !r.position && !r.code),
    [rows]
  );

  function update(entryId: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => (r.entry_id === entryId ? { ...r, ...patch } : r))
    );
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= rows.length) return;
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  /** En modo ordenar, la posición sale del orden (sin contar los códigos). */
  function positionFromOrder(index: number): number | null {
    if (rows[index].code) return null;
    let pos = 0;
    for (let i = 0; i <= index; i++) {
      if (!rows[i].code) pos++;
    }
    return pos;
  }

  // ── Modo llegada ────────────────────────────────────────────
  const finished = useMemo(
    () =>
      rows
        .filter((r) => r.position && !r.code)
        .sort((a, b) => Number(a.position) - Number(b.position)),
    [rows]
  );

  const pending = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows
      .filter((r) => !r.position && !r.code)
      .filter(
        (r) =>
          !term ||
          r.name.toLowerCase().includes(term) ||
          (r.sail_number ?? '').toLowerCase().includes(term)
      );
  }, [rows, query]);

  /** Marca que un barco cruzó: le toca la siguiente posición libre. */
  function finish(entryId: string) {
    update(entryId, { position: String(finished.length + 1), code: '' });
    setQuery('');
  }

  /** Deshace la última llegada registrada. */
  function undoLast() {
    const last = finished[finished.length - 1];
    if (!last) return;
    update(last.entry_id, { position: '' });
  }

  /** Los que no cruzaron se resuelven de una: DNC es el código correcto. */
  function markMissingAs(code: string) {
    setRows((rs) =>
      rs.map((r) => (!r.position && !r.code ? { ...r, code } : r))
    );
  }

  async function save() {
    if (mode === 'write' && duplicates.size > 0) {
      toast.error(`Hay posiciones repetidas: ${[...duplicates].join(', ')}`);
      return;
    }

    const payload = rows
      .map((r, i) => {
        if (r.code) return { entry_id: r.entry_id, code: r.code };
        const pos =
          mode === 'reorder' ? positionFromOrder(i) : Number(r.position);
        if (!pos || !Number.isFinite(pos)) return null;
        return { entry_id: r.entry_id, position: pos };
      })
      .filter((x) => x !== null);

    if (payload.length === 0) {
      toast.error('Cargá al menos un resultado');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/regattas/races/${race.id}/results`, {
        results: payload,
      });
      // Guardado: el borrador ya no hace falta.
      localStorage.removeItem(draftKey(race.id));
      setRestoredDraft(false);
      toast.success(`Manga ${race.race_number} guardada`);
      onSaved();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudieron guardar los resultados'));
    } finally {
      setSaving(false);
    }
  }

  const MODES: { id: Mode; label: string }[] = [
    { id: 'finish', label: '🏁 Llegada' },
    { id: 'write', label: '✍️ Escribir' },
    { id: 'reorder', label: '↕️ Ordenar' },
  ];

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-navy-50 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                mode === m.id
                  ? 'bg-white text-navy-800 shadow-sm'
                  : 'text-navy-500'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {mode === 'finish' && (
          <span className="text-xs text-navy-400">
            Tocá cada barco cuando cruza
          </span>
        )}
        {mode === 'reorder' && (
          <span className="text-xs text-navy-400">
            Arrastrá o usá ▲▼ — la posición se numera sola
          </span>
        )}
      </div>

      {restoredDraft && (
        <p className="mb-3 rounded-lg bg-sand-100 px-3 py-2 text-xs text-sand-700">
          Se recuperó lo que habías cargado sin guardar en este dispositivo.
        </p>
      )}

      {mode === 'finish' ? (
        <div className="flex flex-col gap-4">
          {/* Orden de llegada */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-navy-500 uppercase">
                Llegaron ({finished.length})
              </p>
              {finished.length > 0 && (
                <button
                  type="button"
                  onClick={undoLast}
                  className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-water-600 hover:bg-water-50"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Deshacer
                </button>
              )}
            </div>

            {finished.length === 0 ? (
              <p className="rounded-lg border border-dashed border-navy-200 px-3 py-4 text-center text-sm text-navy-400">
                Todavía no cruzó nadie.
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {finished.map((r) => (
                  <li
                    key={r.entry_id}
                    className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white px-3 py-2"
                  >
                    <span className="w-7 shrink-0 text-center text-sm font-bold text-navy-900">
                      {r.position}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                      {r.name}
                      {r.sail_number && (
                        <span className="ml-1 text-xs text-navy-400">
                          {r.sail_number}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => update(r.entry_id, { position: '' })}
                      aria-label={`Quitar a ${r.name} de la llegada`}
                      className="focus-ring rounded px-2 py-1 text-xs text-navy-400 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Barcos que faltan cruzar */}
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-navy-500 uppercase">
              En el agua ({rows.filter((r) => !r.position && !r.code).length})
            </p>

            {rows.filter((r) => !r.position && !r.code).length > 6 && (
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por vela o nombre…"
                  aria-label="Buscar barco"
                  className="pl-9"
                />
              </div>
            )}

            {pending.length === 0 ? (
              <p className="text-sm text-navy-400">
                {query ? 'Ningún barco coincide.' : 'Todos resueltos.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {pending.map((r) => (
                  <button
                    key={r.entry_id}
                    type="button"
                    onClick={() => finish(r.entry_id)}
                    className="focus-ring flex min-h-16 flex-col items-center justify-center rounded-xl border border-navy-200 bg-white px-2 py-3 transition hover:border-water-600 hover:bg-water-50 active:scale-95"
                  >
                    <span className="text-base font-bold text-navy-900">
                      {r.sail_number || r.name}
                    </span>
                    {r.sail_number && (
                      <span className="max-w-full truncate text-xs text-navy-400">
                        {r.name}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Códigos para los que no cruzaron */}
          {rows.some((r) => r.code) && (
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wide text-navy-500 uppercase">
                Con código
              </p>
              <ul className="flex flex-col gap-1.5">
                {rows
                  .filter((r) => r.code)
                  .map((r) => (
                    <li
                      key={r.entry_id}
                      className="flex items-center gap-2 rounded-lg border border-navy-100 bg-navy-50 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                        {r.name}
                      </span>
                      <div className="w-24 shrink-0">
                      <Select
                        value={r.code}
                        onChange={(e) =>
                          update(r.entry_id, { code: e.target.value })
                        }
                        aria-label={`Código de ${r.name}`}
                        className="py-1.5 text-sm"
                      >
                        <option value="">—</option>
                        {RESULT_CODES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r, i) => {
            // El conflicto de posiciones solo existe en modo escribir:
            // al ordenar, la numeración sale del orden y no se repite.
            const isDup =
              mode === 'write' &&
              !r.code &&
              r.position &&
              duplicates.has(r.position);
            const autoPos = mode === 'reorder' ? positionFromOrder(i) : null;
            return (
              <div
                key={r.entry_id}
                draggable={mode === 'reorder'}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  if (mode !== 'reorder' || dragIndex === null) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (mode !== 'reorder' || dragIndex === null) return;
                  e.preventDefault();
                  move(dragIndex, i);
                  setDragIndex(null);
                }}
                className={`flex items-center gap-2 rounded-lg border p-2 ${
                  isDup ? 'border-red-300 bg-red-50' : 'border-navy-100 bg-white'
                } ${mode === 'reorder' ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {mode === 'reorder' && (
                  <>
                    {/* Áreas de toque grandes para móvil */}
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        aria-label="Subir"
                        className="flex h-6 w-9 items-center justify-center rounded text-navy-500 hover:bg-navy-50 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, i + 1)}
                        disabled={i === rows.length - 1}
                        aria-label="Bajar"
                        className="flex h-6 w-9 items-center justify-center rounded text-navy-500 hover:bg-navy-50 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    <span className="w-7 shrink-0 text-center text-sm font-bold text-navy-800">
                      {autoPos ?? '–'}
                    </span>
                  </>
                )}

                <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                  {r.name}
                  {r.sail_number && (
                    <span className="ml-1 text-xs text-navy-400">
                      {r.sail_number}
                    </span>
                  )}
                </span>

                {mode === 'write' && (
                  <input
                    type="number"
                    min={1}
                    value={r.position}
                    disabled={!!r.code}
                    onChange={(e) =>
                      update(r.entry_id, { position: e.target.value })
                    }
                    placeholder="Pos"
                    aria-label={`Posición de ${r.name}`}
                    className={`w-16 rounded-lg border px-2 py-2 text-center text-sm outline-none disabled:bg-navy-50 disabled:opacity-50 ${
                      isDup
                        ? 'border-red-400 text-red-700'
                        : 'border-navy-200 focus:border-navy-500'
                    }`}
                  />
                )}

                {/* El Select trae `w-full`: sin este contenedor de ancho
                    fijo aplasta al nombre del barco. */}
                <div className="w-24 shrink-0">
                  <Select
                    value={r.code}
                    onChange={(e) => update(r.entry_id, { code: e.target.value })}
                    aria-label={`Código de ${r.name}`}
                    className="py-2 text-sm"
                  >
                    <option value="">—</option>
                    {RESULT_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {duplicates.size > 0 && mode === 'write' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Posiciones repetidas: {[...duplicates].join(', ')}. Corregilas antes de
          guardar.
        </p>
      )}

      {/* Nadie debería cerrar una manga sin resolver a todos los inscriptos. */}
      {missing.length > 0 && (
        <div className="mt-3 rounded-lg bg-sand-100 px-3 py-2.5 text-xs text-sand-700">
          <p className="font-semibold">
            {missing.length}{' '}
            {missing.length === 1 ? 'barco sin resultado' : 'barcos sin resultado'}
            : {missing.map((r) => r.sail_number || r.name).join(', ')}
          </p>
          <button
            type="button"
            onClick={() => markMissingAs('DNC')}
            className="focus-ring mt-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-sand-700 hover:bg-sand-50"
          >
            Marcarlos DNC
          </button>
        </div>
      )}

      <Button
        size="sm"
        onClick={save}
        disabled={saving || (mode === 'write' && duplicates.size > 0)}
        className="mt-3"
      >
        {saving ? 'Guardando…' : `Guardar manga ${race.race_number}`}
      </Button>
    </div>
  );
}
