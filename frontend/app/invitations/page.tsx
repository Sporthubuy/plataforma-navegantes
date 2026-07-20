'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Username } from '@/components/username';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Invitation } from '@/lib/types';

export default function InvitationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/crew/invitations')
      .then((res) => setInvitations(res.data.invitations))
      .catch(() => {
        setInvitations([]);
        toast.error('No se pudieron cargar las invitaciones');
      });
  }, [user]);

  async function respond(id: string, action: 'accept' | 'reject') {
    setResponding(id);
    try {
      await api.put(`/api/crew/invitations/${id}/${action}`);
      setInvitations((prev) => (prev ?? []).filter((i) => i.id !== id));
      toast.success(
        action === 'accept' ? '¡Bienvenido a bordo! 🎉' : 'Invitación rechazada'
      );
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo responder la invitación'));
    } finally {
      setResponding(null);
    }
  }

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-5 text-2xl font-bold text-navy-900 md:text-3xl">
        Invitaciones
      </h1>

      {invitations === null ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : invitations.length === 0 ? (
        <Card className="p-8 text-center md:p-10">
          <p className="text-4xl">🔔</p>
          <h2 className="mt-3 font-semibold text-navy-900">
            Sin invitaciones pendientes
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Cuando el dueño de un barco te invite a tripular, aparecerá aquí.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {invitations.map((inv) => (
            <Card key={inv.id} className="p-4">
              <div className="flex items-center gap-3">
                {inv.boat?.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={inv.boat.photo_url}
                    alt={inv.boat.name}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-xl">
                    ⛵
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/boats/${inv.boat?.id}`}
                    className="font-bold text-navy-900 hover:underline"
                  >
                    {inv.boat?.name ?? 'Barco'}
                  </Link>
                  <p className="text-sm text-navy-500">
                    <Username username={inv.boat?.owner?.username} /> te invita
                    como{' '}
                    <span className="font-semibold text-navy-700">
                      {inv.role}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <Button
                  size="sm"
                  fullWidth
                  onClick={() => respond(inv.id, 'accept')}
                  disabled={responding === inv.id}
                >
                  Aceptar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  onClick={() => respond(inv.id, 'reject')}
                  disabled={responding === inv.id}
                >
                  Rechazar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
