'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Username } from '@/components/username';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Select, controlClasses } from '@/components/ui/input';
import type { BoatWithCrew, UserSearchResult } from '@/lib/types';

const CREW_ROLES = [
  'Timonel',
  'Proa',
  'Táctico',
  'Trimmer',
  'Piano',
  'Stratega',
  'Otro',
];

function InviteModal({
  boatId,
  onClose,
  onInvited,
}: {
  boatId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autocompletado en vivo con debounce.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim().replace(/^@/, '');
    if (!q) return;
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      api
        .get('/api/users/search', { params: { q } })
        .then((res) => setResults(res.data.users))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const finalRole = role === 'Otro' ? customRole.trim() : role;
    if (!selected) {
      toast.error('Elige a quién invitar');
      return;
    }
    if (!finalRole) {
      toast.error('Elige o escribe el puesto');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/crew/invite', {
        boat_id: boatId,
        username: selected.username,
        role: finalRole,
      });
      toast.success(`Invitación enviada a @${selected.username}`);
      onInvited();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo enviar la invitación'));
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Invitar tripulante" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {selected ? (
          <div className="flex items-center gap-3 rounded-lg border border-navy-200 bg-navy-50 px-3 py-2">
            <Avatar
              src={selected.avatar_url}
              name={selected.username}
              className="h-9 w-9 text-sm"
            />
            <div className="min-w-0 flex-1">
              <Username username={selected.username} className="text-sm" />
              {selected.name && (
                <p className="truncate text-xs text-navy-500">
                  {selected.name}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-navy-400 hover:text-navy-600"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Buscar por username
            <div className="flex items-center rounded-lg border border-navy-200 px-3 focus-within:border-navy-500 focus-within:ring-2 focus-within:ring-navy-200">
              <span className="text-base text-navy-400">@</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.replace(/^@/, ''))}
                className="w-full bg-transparent py-2.5 pl-0.5 text-base outline-none"
                placeholder="proa_pedro"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            {query.trim() !== '' && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-navy-100">
                {searching && results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-navy-400">Buscando…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-navy-400">
                    Sin resultados
                  </p>
                ) : (
                  results.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelected(u)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-navy-50"
                    >
                      <Avatar
                        src={u.avatar_url}
                        name={u.username}
                        className="h-8 w-8 text-sm"
                      />
                      <span className="min-w-0">
                        <Username username={u.username} className="text-sm" />
                        {u.name && (
                          <span className="block truncate text-xs text-navy-500">
                            {u.name}
                          </span>
                        )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </label>
        )}

        <Field label="Puesto">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="" disabled>
              Elige un puesto…
            </option>
            {CREW_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        {role === 'Otro' && (
          <Field label="¿Cuál?">
            <input
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className={controlClasses}
              placeholder="Escribe el puesto"
            />
          </Field>
        )}

        <Button type="submit" disabled={submitting} fullWidth>
          {submitting ? 'Enviando…' : 'Enviar invitación'}
        </Button>
      </form>
    </Modal>
  );
}

export default function BoatPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [boat, setBoat] = useState<BoatWithCrew | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inviting, setInviting] = useState(false);

  const fetchBoat = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/boats/${params.id}`)
      .then((res) => setBoat(res.data.boat))
      .catch(() => setNotFound(true));
  }, [params.id]);

  useEffect(fetchBoat, [fetchBoat]);

  const isOwner = !!user && !!boat && boat.owner_id === user.id;
  const myCrewEntry =
    user && boat ? boat.crew.find((c) => c.user?.id === user.id) : undefined;

  async function removeCrew(crewId: string, username: string | undefined) {
    const ok = window.confirm(
      `¿Quitar a @${username ?? 'este tripulante'} del barco?`
    );
    if (!ok) return;
    try {
      await api.delete(`/api/crew/${crewId}`);
      toast.success('Tripulante quitado');
      fetchBoat();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo quitar al tripulante'));
    }
  }

  async function leaveBoat() {
    if (!myCrewEntry) return;
    const ok = window.confirm(`¿Abandonar ${boat?.name}?`);
    if (!ok) return;
    try {
      await api.delete(`/api/crew/${myCrewEntry.id}`);
      toast.success('Abandonaste el barco');
      router.push('/boats');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo abandonar el barco'));
    }
  }

  if (notFound) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl">🌊</p>
          <p className="mt-2 font-semibold text-navy-900">Barco no encontrado</p>
          <Link href="/boats" className="mt-3 text-sm text-navy-500 underline">
            Volver a mis barcos
          </Link>
        </div>
      </AppShell>
    );
  }

  if (loading || !boat) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Foto + info del barco */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm lg:sticky lg:top-10">
          {boat.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boat.photo_url}
              alt={boat.name}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-navy-100 text-5xl">
              ⛵
            </div>
          )}
          <div className="p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-navy-900 md:text-2xl">
                  {boat.name}
                </h1>
                <p className="text-sm text-navy-500">
                  {boat.category}
                  {boat.sail_number ? ` · ${boat.sail_number}` : ''}
                </p>
              </div>
              {isOwner && (
                <Link
                  href={`/boats/${boat.id}/edit`}
                  className={buttonClasses('secondary', 'sm')}
                >
                  Editar
                </Link>
              )}
            </div>

            {boat.owner && (
              <div className="mt-4 flex items-center gap-2 text-sm text-navy-600">
                <Avatar
                  src={boat.owner.avatar_url}
                  name={boat.owner.username}
                  className="h-7 w-7 text-xs"
                />
                <span>
                  Dueño: <Username username={boat.owner.username} />
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tripulación */}
        <section className="mt-6 lg:mt-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy-900 md:text-xl">
              Tripulación
            </h2>
            {isOwner && (
              <Button size="sm" onClick={() => setInviting(true)}>
                Invitar tripulante
              </Button>
            )}
          </div>

          {boat.crew.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-sm text-navy-500">
                Todavía no hay tripulantes en este barco.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {boat.crew.map((member) => (
                <Card
                  key={member.id}
                  className="flex items-center gap-3 p-3"
                  padded={false}
                >
                  <Avatar
                    src={member.user?.avatar_url}
                    name={member.user?.username ?? '?'}
                    className="h-10 w-10 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <Username
                      username={member.user?.username}
                      className="text-sm"
                    />
                    <p className="truncate text-xs text-navy-500">
                      {member.role}
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => removeCrew(member.id, member.user?.username)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  )}
                </Card>
              ))}
            </div>
          )}

          {myCrewEntry && !isOwner && (
            <Button
              variant="danger"
              fullWidth
              onClick={leaveBoat}
              className="mt-4"
            >
              Abandonar barco
            </Button>
          )}
        </section>
      </div>

      {inviting && (
        <InviteModal
          boatId={boat.id}
          onClose={() => setInviting(false)}
          onInvited={fetchBoat}
        />
      )}
    </AppShell>
  );
}
