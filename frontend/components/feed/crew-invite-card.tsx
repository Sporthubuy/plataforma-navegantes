'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { Button } from '@/components/ui/button';
import type { Invitation } from '@/lib/types';

/**
 * Invitación a tripular, respondible desde el propio feed.
 * Al responder se desvanece y avisa al feed para que la quite.
 */
export function CrewInviteCard({
  invitation,
  onResolved,
}: {
  invitation: Invitation;
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  async function respond(action: 'accept' | 'reject') {
    setBusy(true);
    try {
      await api.put(`/api/crew/invitations/${invitation.id}/${action}`);
      toast.success(
        action === 'accept' ? '¡Bienvenido a bordo! 🎉' : 'Invitación rechazada'
      );
      // Deja correr la animación de salida antes de quitarla.
      setLeaving(true);
      setTimeout(onResolved, 300);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo responder la invitación'));
      setBusy(false);
    }
  }

  const boat = invitation.boat;

  return (
    <article
      className={`rounded-xl border border-water-600/20 bg-water-50/50 p-4 md:p-5 ${
        leaving
          ? 'animate-[fadeOut_300ms_ease-in_forwards]'
          : 'animate-[fadeIn_300ms_ease-out]'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-water-600">
        <UserPlus className="h-4 w-4" />
        Invitación a tripular
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Avatar
          src={boat?.owner?.avatar_url}
          name={boat?.name ?? '?'}
          className="h-10 w-10 text-base"
        />
        <div className="min-w-0">
          <Link
            href={`/boats/${boat?.id}`}
            className="block truncate font-bold text-navy-900 hover:underline"
          >
            {boat?.name ?? 'Barco'}
          </Link>
          <p className="truncate text-xs text-navy-500">
            <Username username={boat?.owner?.username} className="text-xs" /> te
            invita como{' '}
            <span className="font-semibold text-navy-700">{invitation.role}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => respond('accept')}
          className="bg-sage-700 hover:bg-sage-700/90"
        >
          Aceptar
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => respond('reject')}
        >
          Rechazar
        </Button>
      </div>
    </article>
  );
}
