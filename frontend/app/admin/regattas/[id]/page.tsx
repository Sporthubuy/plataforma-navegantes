'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { RegattaForm, type RegattaFormData } from '@/components/regatta/regatta-form';
import { RegattaStatusBadge, REGATTA_STATUS } from '@/components/regatta/status-badge';
import type {
  Race,
  RegattaDetail,
  RegattaEntry,
  RegattaStatus,
  Standing,
} from '@/lib/types';

const TRANSITIONS: Record<RegattaStatus, RegattaStatus[]> = {
  upcoming: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['finished', 'cancelled'],
  finished: [],
  cancelled: [],
};

const CODES = ['DNF', 'DNS', 'DSQ', 'DNC', 'OCS', 'RET'];

/** Editor de resultados de una manga. */
function RaceResultsEditor({
  race,
  entries,
  existing,
  onSaved,
  onDelete,
}: {
  race: Race;
  entries: RegattaEntry[];
  existing: Map<string, { position: number | null; code: string | null }>;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [rows, setRows] = useState(() =>
    entries.map((e) => {
      const r = existing.get(e.id);
      return {
        entry_id: e.id,
        name: e.boat?.name ?? '—',
        position: r?.position != null ? String(r.position) : '',
        code: r?.code ?? '',
      };
    })
  );
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(entryId: string, patch: Partial<{ position: string; code: string }>) {
    setRows((rs) => rs.map((r) => (r.entry_id === entryId ? { ...r, ...patch } : r)));
  }

  async function save() {
    // Validar posiciones no repetidas (entre los que no tienen código).
    const positions = rows.filter((r) => !r.code && r.position).map((r) => Number(r.position));
    if (new Set(positions).size !== positions.length) {
      toast.error('Hay posiciones repetidas');
      return;
    }
    const payload = rows
      .filter((r) => r.code || r.position)
      .map((r) => ({
        entry_id: r.entry_id,
        position: r.code ? undefined : Number(r.position),
        code: r.code || undefined,
      }));
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
    <Card padded={false} className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-navy-900">
            Manga {race.race_number}
          </span>
          {race.status === 'completed' && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Completada
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-sm font-medium text-navy-600 hover:underline"
          >
            {open ? 'Cerrar' : 'Cargar resultados'}
          </button>
          <button
            onClick={onDelete}
            className="text-sm font-medium text-red-500 hover:underline"
          >
            Borrar
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.entry_id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-navy-700">
                {r.name}
              </span>
              <input
                type="number"
                min={1}
                value={r.position}
                disabled={!!r.code}
                onChange={(e) => update(r.entry_id, { position: e.target.value })}
                placeholder="Pos"
                className="w-16 rounded-lg border border-navy-200 px-2 py-1.5 text-center text-sm outline-none focus:border-navy-500 disabled:bg-navy-50 disabled:opacity-50"
              />
              <Select
                value={r.code}
                onChange={(e) => update(r.entry_id, { code: e.target.value })}
                className="w-24 py-1.5 text-sm"
              >
                <option value="">—</option>
                {CODES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <Button size="sm" onClick={save} disabled={saving} className="mt-2 self-start">
            {saving ? 'Guardando…' : 'Guardar manga'}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function ManageRegattaPage() {
  const { user, loading, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [regatta, setRegatta] = useState<RegattaDetail | null>(null);
  const [entries, setEntries] = useState<RegattaEntry[]>([]);
  const [resultsByRace, setResultsByRace] = useState<
    Map<string, Map<string, { position: number | null; code: string | null }>>
  >(new Map());
  const [savingRegatta, setSavingRegatta] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const canEdit = hasPermission('regattas.edit');
  const canManageResults = hasPermission('regattas.manage_results');
  const canDelete = hasPermission('regattas.delete');

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/regattas/${params.id}`)
      .then((res) => setRegatta(res.data.regatta))
      .catch(() => setNotFound(true));
    api
      .get(`/api/regattas/${params.id}/entries`)
      .then((res) => setEntries(res.data.entries.filter((e: RegattaEntry) => e.status === 'confirmed')))
      .catch(() => setEntries([]));
    api
      .get(`/api/regattas/${params.id}/results`)
      .then((res) => {
        const map = new Map<string, Map<string, { position: number | null; code: string | null }>>();
        for (const s of res.data.standings as Standing[]) {
          for (const rp of s.races) {
            if (!map.has(rp.race_id)) map.set(rp.race_id, new Map());
            map.get(rp.race_id)!.set(s.entry_id, { position: rp.position, code: rp.code });
          }
        }
        setResultsByRace(map);
      })
      .catch(() => setResultsByRace(new Map()));
  }, [params.id]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function saveRegatta(data: RegattaFormData) {
    setSavingRegatta(true);
    try {
      await api.put(`/api/regattas/${params.id}`, data);
      toast.success('Regata actualizada');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar'));
    } finally {
      setSavingRegatta(false);
    }
  }

  async function changeStatus(status: RegattaStatus) {
    setChangingStatus(true);
    try {
      await api.put(`/api/regattas/${params.id}/status`, { status });
      toast.success('Estado actualizado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo cambiar el estado'));
    } finally {
      setChangingStatus(false);
    }
  }

  async function addRace() {
    try {
      await api.post(`/api/regattas/${params.id}/races`, {});
      toast.success('Manga agregada');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar la manga'));
    }
  }

  async function deleteRace(raceId: string) {
    if (!window.confirm('¿Borrar esta manga y sus resultados?')) return;
    try {
      await api.delete(`/api/regattas/races/${raceId}`);
      toast.success('Manga borrada');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  async function deleteRegatta() {
    if (!window.confirm('¿Eliminar la regata completa? No se puede deshacer.')) return;
    try {
      await api.delete(`/api/regattas/${params.id}`);
      toast.success('Regata eliminada');
      router.replace('/admin/regattas');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar'));
    }
  }

  if (notFound) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-navy-900">Regata no encontrada</p>
        <Link href="/admin/regattas" className="mt-3 inline-block text-sm text-navy-500 underline">
          Volver
        </Link>
      </Card>
    );
  }
  if (!regatta) return <p className="text-sm text-navy-400">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/regattas" className="text-sm text-navy-500 hover:underline">
          ← Volver
        </Link>
        <Link href={`/regattas/${regatta.id}`} className="text-sm text-navy-500 hover:underline">
          Ver página pública →
        </Link>
      </div>

      {/* Estado */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-navy-900">{regatta.name}</span>
            <RegattaStatusBadge status={regatta.status} />
          </div>
          {canEdit && TRANSITIONS[regatta.status].length > 0 && (
            <div className="flex flex-wrap gap-2">
              {TRANSITIONS[regatta.status].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={s === 'cancelled' ? 'danger' : 'primary'}
                  disabled={changingStatus}
                  onClick={() => changeStatus(s)}
                >
                  → {REGATTA_STATUS[s].label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Mangas y resultados */}
      {canManageResults && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold text-navy-900">Mangas y resultados</h3>
            <Button size="sm" onClick={addRace}>
              + Agregar manga
            </Button>
          </div>
          {entries.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-navy-500">
                Necesitás inscriptos para cargar resultados.
              </p>
            </Card>
          ) : regatta.races.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-navy-500">
                Todavía no hay mangas. Agregá la primera.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {regatta.races.map((race) => {
                const existing = resultsByRace.get(race.id) ?? new Map();
                return (
                  <RaceResultsEditor
                    // El key incluye la cantidad de resultados cargados para
                    // re-inicializar el editor cuando llegan (carga async).
                    key={`${race.id}-${existing.size}`}
                    race={race}
                    entries={entries}
                    existing={existing}
                    onSaved={load}
                    onDelete={() => deleteRace(race.id)}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Datos de la regata */}
      {canEdit && (
        <section>
          <h3 className="mb-3 text-lg font-bold text-navy-900">Datos de la regata</h3>
          <RegattaForm
            initial={regatta}
            submitLabel="Guardar cambios"
            submitting={savingRegatta}
            lockClass={(regatta.entry_count ?? 0) > 0}
            onSubmit={saveRegatta}
          />
        </section>
      )}

      {canDelete && (
        <div>
          <Button variant="danger" onClick={deleteRegatta}>
            Eliminar regata
          </Button>
        </div>
      )}
    </div>
  );
}
