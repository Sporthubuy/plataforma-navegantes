'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { Card } from '@/components/ui/card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { RegattaStatusBadge } from '@/components/regatta/status-badge';
import { ResultsTable } from '@/components/regatta/results-table';
import { formatDateRange } from '@/lib/format';
import { placeLabel } from '@/lib/geo';
import type {
  ClassResults,
  EligibleBoat,
  RegattaClass,
  RegattaDetail,
  RegattaEntry,
} from '@/lib/types';

function RegisterModal({
  cls,
  onClose,
  onDone,
}: {
  cls: RegattaClass;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState('');
  const boats = cls.eligible_boats ?? [];

  async function register(boatId: string) {
    setSubmitting(boatId);
    try {
      await api.post(`/api/regattas/classes/${cls.id}/register`, {
        boat_id: boatId,
      });
      toast.success('¡Inscripción confirmada!');
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo inscribir'));
      setSubmitting('');
    }
  }

  return (
    <Modal title={`Inscribir en ${cls.sailing_class}`} onClose={onClose}>
      <p className="mb-3 text-sm text-navy-500">
        Solo los barcos de clase <strong>{cls.sailing_class}</strong> pueden
        inscribirse en esta flota.
      </p>
      <div className="flex flex-col gap-2">
        {boats.map((b: EligibleBoat) => (
          <div
            key={b.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              b.eligible ? 'border-navy-200' : 'border-navy-100 opacity-60'
            }`}
          >
            {b.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.photo_url} alt={b.name} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100">
                ⛵
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900">{b.name}</p>
              <p className="truncate text-xs text-navy-400">{b.category}</p>
            </div>
            {b.already_registered ? (
              <span className="text-xs text-navy-400">Ya inscripto</span>
            ) : b.class_matches ? (
              <Button size="sm" disabled={submitting === b.id} onClick={() => register(b.id)}>
                {submitting === b.id ? '…' : 'Inscribir'}
              </Button>
            ) : (
              <span className="text-xs text-amber-600">clase no coincide</span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Panel de inscripción de UNA clase. */
function ClassRegistrationPanel({
  cls,
  onChanged,
}: {
  cls: RegattaClass;
  onChanged: () => void;
}) {
  const [modal, setModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState('');

  const boats = cls.eligible_boats ?? [];
  const myEntries = cls.my_entries ?? [];
  const hasMatchingClass = boats.some((b) => b.class_matches);
  const hasEligible = boats.some((b) => b.eligible);
  const boatName = (boatId: string) =>
    boats.find((b) => b.id === boatId)?.name ?? 'tu barco';

  /** Retira una inscripción concreta: se indica siempre qué barco. */
  async function withdraw(boatId: string) {
    if (!window.confirm(`¿Retirar a ${boatName(boatId)} de ${cls.sailing_class}?`))
      return;
    setWithdrawing(boatId);
    try {
      await api.delete(`/api/regattas/classes/${cls.id}/register`, {
        params: { boat_id: boatId },
      });
      toast.success('Inscripción retirada');
      onChanged();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo retirar'));
    } finally {
      setWithdrawing('');
    }
  }

  if (myEntries.length > 0) {
    return (
      <Card>
        <p className="text-sm text-navy-700">
          {myEntries.length === 1 ? 'Estás inscripto' : 'Tenés barcos inscriptos'} en{' '}
          <strong>{cls.sailing_class}</strong>. ⛵
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {myEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-navy-100 p-2"
            >
              <span className="min-w-0 truncate text-sm font-medium text-navy-800">
                {boatName(entry.boat_id)}
              </span>
              <Button
                variant="danger"
                size="sm"
                onClick={() => withdraw(entry.boat_id)}
                disabled={withdrawing === entry.boat_id}
              >
                {withdrawing === entry.boat_id ? 'Retirando…' : 'Retirar'}
              </Button>
            </div>
          ))}
        </div>
        {hasEligible && cls.status === 'open' && (
          <Button size="sm" className="mt-3" onClick={() => setModal(true)}>
            Inscribir otro barco
          </Button>
        )}
        {modal && (
          <RegisterModal cls={cls} onClose={() => setModal(false)} onDone={onChanged} />
        )}
      </Card>
    );
  }

  if (cls.status !== 'open') {
    return (
      <Card>
        <p className="text-sm text-navy-500">
          {cls.status === 'upcoming'
            ? `Las inscripciones de ${cls.sailing_class} aún no están abiertas.`
            : cls.status === 'in_progress'
              ? `${cls.sailing_class} está en curso: las inscripciones cerraron.`
              : cls.status === 'finished'
                ? `${cls.sailing_class} ya finalizó.`
                : `${cls.sailing_class} fue cancelada.`}
        </p>
      </Card>
    );
  }

  if (!hasMatchingClass) {
    return (
      <Card>
        <p className="text-sm text-navy-700">
          Necesitás un barco clase <strong>{cls.sailing_class}</strong> para
          inscribirte en esta flota.
        </p>
        <Link href="/boats/new" className={`mt-3 ${buttonClasses('primary', 'sm')}`}>
          + Agregar barco
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      {hasEligible ? (
        <>
          <p className="mb-3 text-sm text-navy-700">
            Inscripciones abiertas para {cls.sailing_class}.
          </p>
          <Button onClick={() => setModal(true)}>
            Inscribir mi barco en {cls.sailing_class}
          </Button>
        </>
      ) : (
        <p className="text-sm text-navy-500">
          Todos tus barcos {cls.sailing_class} ya están inscriptos.
        </p>
      )}
      {modal && (
        <RegisterModal cls={cls} onClose={() => setModal(false)} onDone={onChanged} />
      )}
    </Card>
  );
}

export default function RegattaDetailPage() {
  const { user, loading, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [regatta, setRegatta] = useState<RegattaDetail | null>(null);
  const [entries, setEntries] = useState<RegattaEntry[]>([]);
  const [results, setResults] = useState<ClassResults[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [tab, setTab] = useState<'entries' | 'results'>('entries');

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/regattas/${params.id}`)
      .then((res) => {
        const reg: RegattaDetail = res.data.regatta;
        setRegatta(reg);
        setActiveClassId((prev) =>
          prev && reg.classes.some((c) => c.id === prev)
            ? prev
            : (reg.classes[0]?.id ?? null)
        );
      })
      .catch(() => setNotFound(true));
    api
      .get(`/api/regattas/${params.id}/entries`)
      .then((res) => setEntries(res.data.entries))
      .catch(() => setEntries([]));
    api
      .get(`/api/regattas/${params.id}/results`)
      .then((res) => setResults(res.data.classes))
      .catch(() => setResults([]));
  }, [params.id]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (notFound) {
    return (
      <AppShell>
        <div className="py-16 text-center">
          <p className="text-4xl">🏁</p>
          <p className="mt-2 font-semibold text-navy-900">Regata no encontrada</p>
          <Link href="/regattas" className="mt-3 inline-block text-sm text-navy-500 underline">
            Volver a regatas
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading || !user || !regatta) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  const activeClass = regatta.classes.find((c) => c.id === activeClassId) ?? null;
  const classEntries = entries.filter(
    (e) => e.regatta_class_id === activeClassId && e.status === 'confirmed'
  );
  const classResults = results.find((r) => r.regatta_class.id === activeClassId) ?? null;
  const hasResults = (classResults?.races.length ?? 0) > 0;
  const canManage =
    hasPermission('regattas.edit') || hasPermission('regattas.manage_results');

  return (
    <AppShell>
      <Link href="/regattas" className="text-sm text-navy-500 hover:underline">
        ← Volver a regatas
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div>
          {/* Header del campeonato */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {regatta.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={regatta.photo_url}
                alt={regatta.name}
                className="aspect-video w-full object-cover md:max-h-64"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-navy-300 to-navy-600 text-5xl md:max-h-64">
                ⛵
              </div>
            )}
            <div className="p-5 md:p-6">
              <RegattaStatusBadge status={regatta.status} />
              <h1 className="mt-2 text-2xl font-bold text-navy-900 md:text-3xl">
                {regatta.name}
              </h1>
              <p className="mt-1 text-sm text-navy-500">
                {formatDateRange(regatta.start_date, regatta.end_date)}
                {placeLabel(regatta) ? ` · ${placeLabel(regatta)}` : ''}
              </p>
              {regatta.description && (
                <p className="mt-3 max-w-prose text-sm whitespace-pre-wrap text-navy-700">
                  {regatta.description}
                </p>
              )}
              <p className="mt-3 text-xs text-navy-400">
                {regatta.classes.length}{' '}
                {regatta.classes.length === 1 ? 'clase' : 'clases'} ·{' '}
                {regatta.entry_count ?? 0} inscriptos en total
              </p>
            </div>
          </div>

          {/* Pestañas de CLASES */}
          {regatta.classes.length === 0 ? (
            <Card className="mt-6 p-6 text-center">
              <p className="text-sm text-navy-500">
                Este campeonato todavía no tiene clases cargadas.
              </p>
            </Card>
          ) : (
            <>
              <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                {regatta.classes.map((c) => {
                  const active = c.id === activeClassId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setActiveClassId(c.id)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        active
                          ? 'bg-navy-800 text-white'
                          : 'bg-white text-navy-600 shadow-sm hover:bg-navy-50'
                      }`}
                    >
                      {c.sailing_class}
                      <span
                        className={`rounded-full px-1.5 text-xs ${
                          active ? 'bg-white/20' : 'bg-navy-100 text-navy-500'
                        }`}
                      >
                        {c.entry_count ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeClass && (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <RegattaStatusBadge status={activeClass.status} />
                    {activeClass.discards_count > 0 && (
                      <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-medium text-navy-700">
                        {activeClass.discards_count} descarte
                        {activeClass.discards_count > 1 ? 's' : ''}
                      </span>
                    )}
                    {activeClass.max_entries && (
                      <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-medium text-navy-700">
                        cupo {activeClass.max_entries}
                      </span>
                    )}
                  </div>

                  {/* Sub-pestañas: inscriptos / resultados */}
                  <div className="mt-4 mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm md:max-w-xs">
                    <button
                      onClick={() => setTab('entries')}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                        tab === 'entries' ? 'bg-navy-800 text-white' : 'text-navy-600'
                      }`}
                    >
                      Inscriptos
                    </button>
                    <button
                      onClick={() => setTab('results')}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                        tab === 'results' ? 'bg-navy-800 text-white' : 'text-navy-600'
                      }`}
                    >
                      Resultados
                    </button>
                  </div>

                  {tab === 'entries' ? (
                    classEntries.length === 0 ? (
                      <Card className="p-6 text-center">
                        <p className="text-sm text-navy-500">
                          Todavía no hay inscriptos en {activeClass.sailing_class}.
                        </p>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {classEntries.map((e) => (
                          <Card key={e.id} className="flex items-center gap-3 p-3" padded={false}>
                            <Avatar
                              src={e.boat?.owner?.avatar_url}
                              name={e.boat?.name ?? '?'}
                              className="h-10 w-10 text-base"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-navy-900">
                                {e.boat?.name}
                                {e.sail_number && (
                                  <span className="ml-1 text-xs font-normal text-navy-400">
                                    {e.sail_number}
                                  </span>
                                )}
                              </p>
                              <Username username={e.boat?.owner?.username} className="text-xs" />
                            </div>
                          </Card>
                        ))}
                      </div>
                    )
                  ) : hasResults ? (
                    <ResultsTable
                      races={classResults!.races}
                      standings={classResults!.standings}
                      effectiveDiscards={classResults!.effective_discards}
                      penaltyPoints={classResults!.penalty_points}
                    />
                  ) : (
                    <Card className="p-6 text-center">
                      <p className="text-sm text-navy-500">
                        Todavía no hay resultados en {activeClass.sailing_class}.
                      </p>
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Columna lateral: inscripción de la clase activa + admin */}
        <div className="mt-6 flex flex-col gap-4 lg:mt-0">
          {activeClass && (
            <ClassRegistrationPanel cls={activeClass} onChanged={load} />
          )}
          {canManage && (
            <Link
              href={`/admin/regattas/${regatta.id}`}
              className={buttonClasses('secondary', 'md', true)}
            >
              ⚙️ Gestionar campeonato
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
