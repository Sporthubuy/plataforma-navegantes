'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { RegattaForm, type RegattaFormData } from '@/components/regatta/regatta-form';
import {
  RegattaStatusBadge,
  REGATTA_STATUS,
  allowedRegattaStatuses,
  isTerminalStatus,
} from '@/components/regatta/status-badge';
import type { RegattaDetail, RegattaStatus } from '@/lib/types';

const CLASSES = BOAT_CATEGORIES.filter((c) => c !== 'Otra');
const ALL_STATUS: RegattaStatus[] = [
  'upcoming',
  'open',
  'in_progress',
  'finished',
  'cancelled',
];

/** Formulario para agregar una clase al campeonato. */
function AddClassForm({
  regattaId,
  onAdded,
}: {
  regattaId: string;
  onAdded: () => void;
}) {
  const [sailingClass, setSailingClass] = useState('');
  const [custom, setCustom] = useState('');
  const [discards, setDiscards] = useState('0');
  const [maxEntries, setMaxEntries] = useState('');
  const [status, setStatus] = useState<RegattaStatus>('upcoming');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const final = sailingClass === 'Otra' ? custom.trim() : sailingClass;
    if (!final) {
      toast.error('Elegí la clase');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/regattas/${regattaId}/classes`, {
        sailing_class: final,
        discards_count: Number(discards) || 0,
        max_entries: maxEntries ? Number(maxEntries) : null,
        status,
      });
      toast.success(`Clase ${final} agregada`);
      setSailingClass('');
      setCustom('');
      setDiscards('0');
      setMaxEntries('');
      onAdded();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar la clase'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h4 className="mb-3 font-semibold text-navy-900">Agregar clase</h4>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Clase de vela *">
            <Select
              value={sailingClass}
              onChange={(e) => setSailingClass(e.target.value)}
            >
              <option value="">Elegí una clase…</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Otra">Otra</option>
            </Select>
          </Field>
          <Field label="Estado inicial">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as RegattaStatus)}
            >
              {ALL_STATUS.map((s) => (
                <option key={s} value={s}>
                  {REGATTA_STATUS[s].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {sailingClass === 'Otra' && (
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Escribe la clase"
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descartes" hint="0 = ninguno">
            <Input
              type="number"
              min={0}
              value={discards}
              onChange={(e) => setDiscards(e.target.value)}
            />
          </Field>
          <Field label="Cupo (opcional)">
            <Input
              type="number"
              min={1}
              value={maxEntries}
              onChange={(e) => setMaxEntries(e.target.value)}
              placeholder="Sin límite"
            />
          </Field>
        </div>
        <Button type="submit" disabled={saving} size="sm" className="self-start">
          {saving ? 'Agregando…' : '+ Agregar clase'}
        </Button>
      </form>
    </Card>
  );
}

export default function ManageRegattaPage() {
  const { user, loading, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [regatta, setRegatta] = useState<RegattaDetail | null>(null);
  const [savingRegatta, setSavingRegatta] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const canEdit = hasPermission('regattas.edit');
  const canDelete = hasPermission('regattas.delete');

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/regattas/${params.id}`)
      .then((res) => setRegatta(res.data.regatta))
      .catch(() => setNotFound(true));
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
      toast.success('Campeonato actualizado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar'));
    } finally {
      setSavingRegatta(false);
    }
  }

  async function changeStatus(status: RegattaStatus) {
    try {
      await api.put(`/api/regattas/${params.id}/status`, { status });
      toast.success('Estado del campeonato actualizado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo cambiar el estado'));
    }
  }

  async function deleteClass(classId: string, name: string) {
    if (
      !window.confirm(
        `¿Borrar la clase ${name}? Se eliminan sus mangas e inscripciones.`
      )
    )
      return;
    try {
      await api.delete(`/api/regattas/classes/${classId}`);
      toast.success('Clase eliminada');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar la clase'));
    }
  }

  async function deleteRegatta() {
    if (!window.confirm('¿Eliminar el campeonato completo? No se puede deshacer.'))
      return;
    try {
      await api.delete(`/api/regattas/${params.id}`);
      toast.success('Campeonato eliminado');
      router.replace('/admin/regattas');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar'));
    }
  }

  if (notFound) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold text-navy-900">Campeonato no encontrado</p>
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

      {/* Estado paraguas */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-navy-900">{regatta.name}</span>
            <RegattaStatusBadge status={regatta.status} />
          </div>
          {canEdit &&
            (isTerminalStatus(regatta.status) ? (
              <span className="text-xs text-navy-400">
                Estado final: ya no admite cambios.
              </span>
            ) : (
              // Solo los estados alcanzables: el backend rechaza el resto.
              <Select
                value={regatta.status}
                onChange={(e) => changeStatus(e.target.value as RegattaStatus)}
                className="w-auto py-1.5 text-sm"
                aria-label="Estado del campeonato"
              >
                {allowedRegattaStatuses(regatta.status).map((s) => (
                  <option key={s} value={s}>
                    {REGATTA_STATUS[s].label}
                  </option>
                ))}
              </Select>
            ))}
        </div>
        <p className="mt-2 text-xs text-navy-400">
          Estado informativo del campeonato. Las inscripciones y resultados los
          gobierna el estado de cada clase. El ciclo avanza en un solo sentido:
          próxima → inscripciones abiertas → en curso → finalizada.
        </p>
      </Card>

      {/* Clases */}
      <section>
        <h3 className="mb-3 text-lg font-bold text-navy-900">
          Clases del campeonato ({regatta.classes.length})
        </h3>

        {regatta.classes.length === 0 ? (
          <Card className="mb-4 p-6 text-center">
            <p className="text-sm text-navy-500">
              Todavía no hay clases. Agregá la primera para poder inscribir
              barcos y cargar mangas.
            </p>
          </Card>
        ) : (
          <div className="mb-4 flex flex-col gap-2">
            {regatta.classes.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-navy-900">{c.sailing_class}</span>
                    <RegattaStatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {c.entry_count ?? 0} inscriptos · {(c.races ?? []).length} mangas
                    · {c.discards_count} descarte{c.discards_count === 1 ? '' : 's'}
                    {c.max_entries ? ` · cupo ${c.max_entries}` : ''}
                  </p>
                </div>
                <Link
                  href={`/admin/regattas/${regatta.id}/classes/${c.id}`}
                  className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
                >
                  Mangas y resultados →
                </Link>
                {canDelete && (
                  <button
                    onClick={() => deleteClass(c.id, c.sailing_class)}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Borrar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && <AddClassForm regattaId={regatta.id} onAdded={load} />}
      </section>

      {/* Datos del campeonato */}
      {canEdit && (
        <section>
          <h3 className="mb-3 text-lg font-bold text-navy-900">
            Datos del campeonato
          </h3>
          <RegattaForm
            initial={regatta}
            submitLabel="Guardar cambios"
            submitting={savingRegatta}
            onSubmit={saveRegatta}
          />
        </section>
      )}

      {canDelete && (
        <div>
          <Button variant="danger" onClick={deleteRegatta}>
            Eliminar campeonato
          </Button>
        </div>
      )}
    </div>
  );
}
