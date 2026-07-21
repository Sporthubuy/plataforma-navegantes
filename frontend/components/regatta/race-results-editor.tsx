'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import type { Race, RegattaEntry } from '@/lib/types';

export const RESULT_CODES = ['DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET'];

interface Row {
  entry_id: string;
  name: string;
  sail_number: string | null;
  position: string;
  code: string;
}

/**
 * Carga de resultados de una manga. Dos modos:
 * - "escribir": un input de posición por barco (default, ideal en móvil).
 * - "ordenar": se reordena la lista y la posición se numera sola.
 * En ambos, cada barco puede llevar un código (DNF, DSQ…) en vez de posición.
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
  const [mode, setMode] = useState<'write' | 'reorder'>('write');
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [rows, setRows] = useState<Row[]>(() => {
    const initial = entries.map((e) => {
      const r = existing.get(e.id);
      return {
        entry_id: e.id,
        name: e.boat?.name ?? '—',
        sail_number: e.sail_number,
        position: r?.position != null ? String(r.position) : '',
        code: r?.code ?? '',
      };
    });
    // Si ya hay posiciones cargadas, mostrarlas en orden de llegada.
    return initial.sort((a, b) => {
      const pa = a.position ? Number(a.position) : Number.MAX_SAFE_INTEGER;
      const pb = b.position ? Number(b.position) : Number.MAX_SAFE_INTEGER;
      return pa - pb;
    });
  });

  /** Posiciones repetidas (solo en modo escribir). */
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (r.code || !r.position) continue;
      seen.set(r.position, (seen.get(r.position) ?? 0) + 1);
    }
    return new Set(
      [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p)
    );
  }, [rows]);

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

  async function save() {
    if (mode === 'write' && duplicates.size > 0) {
      toast.error(`Hay posiciones repetidas: ${[...duplicates].join(', ')}`);
      return;
    }

    const payload = rows
      .map((r, i) => {
        if (r.code) return { entry_id: r.entry_id, code: r.code };
        const pos = mode === 'reorder' ? positionFromOrder(i) : Number(r.position);
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
      await api.put(`/api/regattas/races/${race.id}/results`, { results: payload });
      toast.success(`Manga ${race.race_number} guardada`);
      onSaved();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudieron guardar los resultados'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      {/* Toggle de modo */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-navy-50 p-1">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === 'write' ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            }`}
          >
            ✍️ Escribir
          </button>
          <button
            type="button"
            onClick={() => setMode('reorder')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              mode === 'reorder' ? 'bg-white text-navy-800 shadow-sm' : 'text-navy-500'
            }`}
          >
            ↕️ Ordenar
          </button>
        </div>
        {mode === 'reorder' && (
          <span className="text-xs text-navy-400">
            Arrastrá o usá ▲▼ — la posición se numera sola
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => {
          // El conflicto de posiciones solo existe en modo escribir:
          // al ordenar, la numeración sale del orden y no puede repetirse.
          const isDup =
            mode === 'write' && !r.code && r.position && duplicates.has(r.position);
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
                  <span className="ml-1 text-xs text-navy-400">{r.sail_number}</span>
                )}
              </span>

              {mode === 'write' && (
                <input
                  type="number"
                  min={1}
                  value={r.position}
                  disabled={!!r.code}
                  onChange={(e) => update(r.entry_id, { position: e.target.value })}
                  placeholder="Pos"
                  aria-label={`Posición de ${r.name}`}
                  className={`w-16 rounded-lg border px-2 py-2 text-center text-sm outline-none disabled:bg-navy-50 disabled:opacity-50 ${
                    isDup
                      ? 'border-red-400 text-red-700'
                      : 'border-navy-200 focus:border-navy-500'
                  }`}
                />
              )}

              <Select
                value={r.code}
                onChange={(e) => update(r.entry_id, { code: e.target.value })}
                aria-label={`Código de ${r.name}`}
                className="w-24 py-2 text-sm"
              >
                <option value="">—</option>
                {RESULT_CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>

      {duplicates.size > 0 && mode === 'write' && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          Posiciones repetidas: {[...duplicates].join(', ')}. Corregilas antes de
          guardar.
        </p>
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
