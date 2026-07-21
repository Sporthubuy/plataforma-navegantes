'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { RaceResultsEditor } from '@/components/regatta/race-results-editor';
import { RegattaStatusBadge, REGATTA_STATUS } from '@/components/regatta/status-badge';
import type {
  ClassResults,
  Race,
  RegattaEntry,
  RegattaStatus,
} from '@/lib/types';

const ALL_STATUS: RegattaStatus[] = [
  'upcoming',
  'open',
  'in_progress',
  'finished',
  'cancelled',
];

/** Una manga con su editor de resultados desplegable. */
function RaceRow({
  race,
  entries,
  existing,
  canManage,
  onSaved,
  onDelete,
}: {
  race: Race;
  entries: RegattaEntry[];
  existing: Map<string, { position: number | null; code: string | null }>;
  canManage: boolean;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card padded={false} className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        {canManage && (
          <div className="flex gap-3">
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
        )}
      </div>

      {open && entries.length === 0 && (
        <p className="mt-3 text-sm text-navy-400">
          No hay inscriptos en esta clase todavía.
        </p>
      )}
      {open && entries.length > 0 && (
        <RaceResultsEditor
          race={race}
          entries={entries}
          existing={existing}
          onSaved={onSaved}
        />
      )}
    </Card>
  );
}

export default function ManageClassPage() {
  const { user, loading, hasPermission } = useAuth();
  const params = useParams<{ id: string; classId: string }>();
  const router = useRouter();

  const [data, setData] = useState<ClassResults | null>(null);
  const [entries, setEntries] = useState<RegattaEntry[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [discards, setDiscards] = useState('0');
  const [maxEntries, setMaxEntries] = useState('');

  const canManageResults = hasPermission('regattas.manage_results');
  const canEdit = hasPermission('regattas.edit');

  const load = useCallback(() => {
    if (!params.classId) return;
    api
      .get(`/api/regattas/classes/${params.classId}/results`)
      .then((res) => {
        const d: ClassResults = res.data;
        setData(d);
        setDiscards(String(d.regatta_class.discards_count));
        setMaxEntries(
          d.regatta_class.max_entries != null
            ? String(d.regatta_class.max_entries)
            : ''
        );
      })
      .catch(() => setNotFound(true));
    api
      .get(`/api/regattas/classes/${params.classId}/entries`)
      .then((res) =>
        setEntries(
          res.data.entries.filter((e: RegattaEntry) => e.status === 'confirmed')
        )
      )
      .catch(() => setEntries([]));
  }, [params.classId]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      await api.put(`/api/regattas/classes/${params.classId}`, {
        discards_count: Number(discards) || 0,
        max_entries: maxEntries ? Number(maxEntries) : null,
      });
      toast.success('Configuración guardada');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar'));
    } finally {
      setSavingConfig(false);
    }
  }

  async function changeStatus(status: RegattaStatus) {
    try {
      await api.put(`/api/regattas/classes/${params.classId}/status`, { status });
      toast.success('Estado de la clase actualizado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo cambiar el estado'));
    }
  }

  async function addRace() {
    try {
      await api.post(`/api/regattas/classes/${params.classId}/races`, {});
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

  if (notFound) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-navy-900">Clase no encontrada</p>
        <Link
          href={`/admin/regattas/${params.id}`}
          className="mt-3 inline-block text-sm text-navy-500 underline"
        >
          Volver al campeonato
        </Link>
      </Card>
    );
  }
  if (!data) return <p className="text-sm text-navy-400">Cargando…</p>;

  const cls = data.regatta_class;

  // Resultados existentes por manga (para prefilar el editor).
  const resultsByRace = new Map<
    string,
    Map<string, { position: number | null; code: string | null }>
  >();
  for (const s of data.standings) {
    for (const rp of s.races) {
      if (!resultsByRace.has(rp.race_id)) resultsByRace.set(rp.race_id, new Map());
      resultsByRace
        .get(rp.race_id)!
        .set(s.entry_id, { position: rp.position, code: rp.code });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/admin/regattas/${params.id}`}
        className="text-sm text-navy-500 hover:underline"
      >
        ← Volver al campeonato
      </Link>

      {/* Cabecera de la clase */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-navy-900">
              {cls.sailing_class}
            </span>
            <RegattaStatusBadge status={cls.status} />
          </div>
          {canEdit && (
            <Select
              value={cls.status}
              onChange={(e) => changeStatus(e.target.value as RegattaStatus)}
              className="w-auto py-1.5 text-sm"
              aria-label="Estado de la clase"
            >
              {ALL_STATUS.map((s) => (
                <option key={s} value={s}>
                  {REGATTA_STATUS[s].label}
                </option>
              ))}
            </Select>
          )}
        </div>
        <p className="mt-2 text-sm text-navy-500">
          {data.entry_count} inscriptos · {data.completed_races} mangas completadas
        </p>

        {/* Config de descartes */}
        {canEdit && (
          <div className="mt-4 border-t border-navy-100 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Descartes" hint={`Aplican desde ${data.discard_threshold} mangas`}>
                <Input
                  type="number"
                  min={0}
                  value={discards}
                  onChange={(e) => setDiscards(e.target.value)}
                />
              </Field>
              <Field label="Cupo">
                <Input
                  type="number"
                  min={1}
                  value={maxEntries}
                  onChange={(e) => setMaxEntries(e.target.value)}
                  placeholder="Sin límite"
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Guardando…' : 'Guardar configuración'}
              </Button>
              <span className="text-xs text-navy-500">
                {data.effective_discards > 0 ? (
                  <>
                    Descartando <strong>{data.effective_discards}</strong>{' '}
                    {data.effective_discards === 1 ? 'manga' : 'mangas'} por barco.
                  </>
                ) : cls.discards_count > 0 ? (
                  <>
                    Configurados {cls.discards_count}, pero no aplican todavía:
                    hacen falta {data.discard_threshold} mangas completadas.
                  </>
                ) : (
                  'Sin descartes.'
                )}
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Mangas y resultados */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-navy-900">Mangas y resultados</h3>
          {canManageResults && (
            <Button size="sm" onClick={addRace}>
              + Agregar manga
            </Button>
          )}
        </div>

        {data.races.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-navy-500">
              Todavía no hay mangas en {cls.sailing_class}. Agregá la primera.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {data.races.map((race) => {
              const existing = resultsByRace.get(race.id) ?? new Map();
              return (
                <RaceRow
                  // El key incluye los resultados cargados para re-inicializar
                  // el editor cuando llegan (carga async).
                  key={`${race.id}-${existing.size}`}
                  race={race}
                  entries={entries}
                  existing={existing}
                  canManage={canManageResults}
                  onSaved={load}
                  onDelete={() => deleteRace(race.id)}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
