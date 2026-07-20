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
import type {
  EligibleBoat,
  Race,
  RegattaDetail,
  RegattaEntry,
  Standing,
} from '@/lib/types';

function RegisterModal({
  regattaId,
  sailingClass,
  boats,
  onClose,
  onDone,
}: {
  regattaId: string;
  sailingClass: string;
  boats: EligibleBoat[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState('');

  async function register(boatId: string) {
    setSubmitting(boatId);
    try {
      await api.post(`/api/regattas/${regattaId}/register`, { boat_id: boatId });
      toast.success('¡Inscripción confirmada!');
      onDone();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo inscribir'));
      setSubmitting('');
    }
  }

  return (
    <Modal title="Inscribir mi barco" onClose={onClose}>
      <p className="mb-3 text-sm text-navy-500">
        Solo los barcos de clase <strong>{sailingClass}</strong> pueden
        inscribirse.
      </p>
      <div className="flex flex-col gap-2">
        {boats.map((b) => (
          <div
            key={b.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              b.eligible ? 'border-navy-200' : 'border-navy-100 opacity-60'
            }`}
          >
            {b.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.photo_url}
                alt={b.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100">
                ⛵
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-navy-900">
                {b.name}
              </p>
              <p className="truncate text-xs text-navy-400">{b.category}</p>
            </div>
            {b.already_registered ? (
              <span className="text-xs text-navy-400">Ya inscripto</span>
            ) : b.class_matches ? (
              <Button
                size="sm"
                disabled={submitting === b.id}
                onClick={() => register(b.id)}
              >
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

/** Bloque de inscripción contextual. */
function RegistrationPanel({
  regatta,
  eligibleBoats,
  myEntry,
  onChanged,
}: {
  regatta: RegattaDetail;
  eligibleBoats: EligibleBoat[];
  myEntry: { boat_id: string } | null;
  onChanged: () => void;
}) {
  const [modal, setModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const myBoat = eligibleBoats.find((b) => b.id === myEntry?.boat_id);
  const hasMatchingClass = eligibleBoats.some((b) => b.class_matches);
  const hasEligible = eligibleBoats.some((b) => b.eligible);

  async function withdraw() {
    if (!window.confirm('¿Retirar tu inscripción de esta regata?')) return;
    setWithdrawing(true);
    try {
      await api.delete(`/api/regattas/${regatta.id}/register`);
      toast.success('Inscripción retirada');
      onChanged();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo retirar'));
    } finally {
      setWithdrawing(false);
    }
  }

  // Ya inscripto
  if (myEntry) {
    return (
      <Card>
        <p className="text-sm text-navy-700">
          Estás inscripto{myBoat ? ` con ${myBoat.name}` : ''}. ¡Nos vemos en el
          agua! ⛵
        </p>
        <Button
          variant="danger"
          size="sm"
          className="mt-3"
          onClick={withdraw}
          disabled={withdrawing}
        >
          {withdrawing ? 'Retirando…' : 'Retirar inscripción'}
        </Button>
      </Card>
    );
  }

  // Inscripción no abierta
  if (regatta.status !== 'open') {
    return (
      <Card>
        <p className="text-sm text-navy-500">
          {regatta.status === 'upcoming'
            ? 'Las inscripciones aún no están abiertas.'
            : regatta.status === 'in_progress'
              ? 'La regata está en curso, las inscripciones cerraron.'
              : regatta.status === 'finished'
                ? 'Esta regata ya finalizó.'
                : 'Esta regata fue cancelada.'}
        </p>
      </Card>
    );
  }

  // Abierta pero sin barco de la clase
  if (!hasMatchingClass) {
    return (
      <Card>
        <p className="text-sm text-navy-700">
          Necesitás un barco clase{' '}
          <strong>{regatta.sailing_class}</strong> para inscribirte.
        </p>
        <Link
          href="/boats/new"
          className={`mt-3 ${buttonClasses('primary', 'sm')}`}
        >
          + Agregar barco
        </Link>
      </Card>
    );
  }

  // Abierta y tiene barco elegible (o todos ya inscriptos)
  return (
    <Card>
      {hasEligible ? (
        <>
          <p className="mb-3 text-sm text-navy-700">
            Tenés barcos clase {regatta.sailing_class} para inscribir.
          </p>
          <Button onClick={() => setModal(true)}>Inscribir mi barco</Button>
        </>
      ) : (
        <p className="text-sm text-navy-500">
          Todos tus barcos clase {regatta.sailing_class} ya están inscriptos.
        </p>
      )}
      {modal && (
        <RegisterModal
          regattaId={regatta.id}
          sailingClass={regatta.sailing_class}
          boats={eligibleBoats}
          onClose={() => setModal(false)}
          onDone={onChanged}
        />
      )}
    </Card>
  );
}

export default function RegattaDetailPage() {
  const { user, loading, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [regatta, setRegatta] = useState<RegattaDetail | null>(null);
  const [eligibleBoats, setEligibleBoats] = useState<EligibleBoat[]>([]);
  const [myEntry, setMyEntry] = useState<{ boat_id: string } | null>(null);
  const [entries, setEntries] = useState<RegattaEntry[]>([]);
  const [results, setResults] = useState<{ races: Race[]; standings: Standing[] } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<'entries' | 'results'>('entries');

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/regattas/${params.id}`)
      .then((res) => {
        setRegatta(res.data.regatta);
        setEligibleBoats(res.data.eligible_boats ?? []);
        setMyEntry(res.data.my_entry ?? null);
      })
      .catch(() => setNotFound(true));
    api
      .get(`/api/regattas/${params.id}/entries`)
      .then((res) => setEntries(res.data.entries))
      .catch(() => setEntries([]));
    api
      .get(`/api/regattas/${params.id}/results`)
      .then((res) => setResults(res.data))
      .catch(() => setResults(null));
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

  const confirmedEntries = entries.filter((e) => e.status === 'confirmed');
  const hasResults = (results?.races.length ?? 0) > 0;
  const canManage =
    hasPermission('regattas.edit') || hasPermission('regattas.manage_results');

  return (
    <AppShell>
      <Link href="/regattas" className="text-sm text-navy-500 hover:underline">
        ← Volver a regatas
      </Link>

      <div className="mt-3 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div>
          {/* Header */}
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
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RegattaStatusBadge status={regatta.status} />
                <span className="rounded-full bg-navy-100 px-2.5 py-0.5 text-xs font-medium text-navy-700">
                  {regatta.sailing_class}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-navy-900 md:text-3xl">
                {regatta.name}
              </h1>
              <p className="mt-1 text-sm text-navy-500">
                {formatDateRange(regatta.start_date, regatta.end_date)}
                {regatta.location ? ` · ${regatta.location}` : ''}
              </p>
              {regatta.description && (
                <p className="mt-3 max-w-prose text-sm whitespace-pre-wrap text-navy-700">
                  {regatta.description}
                </p>
              )}
              <p className="mt-3 text-xs text-navy-400">
                {regatta.entry_count ?? confirmedEntries.length} inscriptos
                {regatta.max_entries ? ` · cupo ${regatta.max_entries}` : ''}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6">
            <div className="mb-4 flex gap-1 rounded-xl bg-white p-1 shadow-sm md:max-w-xs">
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
              confirmedEntries.length === 0 ? (
                <Card className="p-6 text-center">
                  <p className="text-sm text-navy-500">Todavía no hay inscriptos.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {confirmedEntries.map((e) => (
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
              <ResultsTable races={results!.races} standings={results!.standings} />
            ) : (
              <Card className="p-6 text-center">
                <p className="text-sm text-navy-500">
                  Todavía no hay resultados cargados.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Columna lateral: inscripción + admin */}
        <div className="mt-6 flex flex-col gap-4 lg:mt-0">
          <RegistrationPanel
            regatta={regatta}
            eligibleBoats={eligibleBoats}
            myEntry={myEntry}
            onChanged={load}
          />
          {canManage && (
            <Link
              href={`/admin/regattas/${regatta.id}`}
              className={buttonClasses('secondary', 'md', true)}
            >
              ⚙️ Gestionar regata
            </Link>
          )}
        </div>
      </div>
    </AppShell>
  );
}
