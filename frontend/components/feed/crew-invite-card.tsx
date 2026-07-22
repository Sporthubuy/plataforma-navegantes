'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Ship, Check, X } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import type { Invitation } from '@/lib/types';
import { FeedItemShell } from './feed-item-shell';

const TYPE_STYLE = {
  label: 'Invitación',
  badge: 'bg-water-50 text-water-600',
};

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
      toast.success(action === 'accept' ? '¡Bienvenido a bordo! 🎉' : 'Invitación rechazada');
      setLeaving(true);
      setTimeout(onResolved, 300);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo responder la invitación'));
      setBusy(false);
    }
  }

  const boat = invitation.boat;

  const footer = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => respond('accept')}
        className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-sage-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sage-700/90 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
        Aceptar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => respond('reject')}
        className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-navy-200 px-3 py-1.5 text-xs font-semibold text-navy-600 transition hover:bg-navy-50 disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" />
        Rechazar
      </button>
    </div>
  );

  return (
    <div className={leaving ? 'animate-[fadeOut_300ms_ease-in_forwards]' : ''}>
      <FeedItemShell
        typeStyle={TYPE_STYLE}
        accent
        actor={
          boat?.owner
            ? {
                name: boat.owner.name || `@${boat.owner.username}`,
                username: boat.owner.username,
                avatar_url: boat.owner.avatar_url,
                href: boat.owner.id ? `/profile/${boat.owner.id}` : undefined,
                headline: `te invita como ${invitation.role}`,
              }
            : null
        }
        footer={footer}
      >
        <Link
          href={`/boats/${boat?.id ?? '#'}`}
          className="flex items-center gap-2 rounded-lg border border-navy-100 bg-white p-2 transition hover:border-navy-200"
        >
          {boat?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boat.photo_url}
              alt={boat.name ?? 'Barco'}
              className="h-9 w-9 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-navy-100">
              <Ship className="h-4 w-4 text-navy-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-navy-950">{boat?.name ?? 'Barco'}</p>
            <p className="truncate text-xs text-navy-500">
              {boat?.category ?? '—'}
              {boat?.sail_number ? ` · #${boat.sail_number}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-water-50 px-2 py-0.5 text-[10px] font-semibold text-water-600">
            {invitation.role}
          </span>
        </Link>
      </FeedItemShell>
    </div>
  );
}