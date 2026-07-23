'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Hand, Sailboat, Waves } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/cv/cv-sections';
import type { CommunityActivity } from '@/lib/types';

const nf = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 });

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-UY', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Una salida en el feed del inicio. Es lo que hace comunidad: mostrar
 * que la gente sale a navegar, sin compararla con nadie.
 *
 * El aplauso ("kudos") es la única reacción a propósito: una salida no
 * se debate, se celebra. Un solo toque baja la fricción al mínimo, que
 * es lo que sostiene que la gente siga publicando.
 */
export function ActivityCard({ activity }: { activity: CommunityActivity }) {
  const user = activity.user;

  const [kudos, setKudos] = useState(activity.kudos_count ?? 0);
  const [mine, setMine] = useState(activity.kudos_by_me ?? false);
  const [busy, setBusy] = useState(false);

  async function toggleKudos() {
    if (busy) return;
    // Optimista: el aplauso responde al toque y se revierte si falla.
    const previous = { kudos, mine };
    setMine(!mine);
    setKudos(kudos + (mine ? -1 : 1));
    setBusy(true);
    try {
      const res = await api.post(
        `/api/community/activities/${activity.id}/kudos`
      );
      setMine(res.data.kudos_by_me);
      setKudos(res.data.kudos_count);
    } catch (err) {
      setMine(previous.mine);
      setKudos(previous.kudos);
      toast.error(getApiError(err, 'No se pudo aplaudir'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="animate-[fadeIn_300ms_ease-out] rounded-xl border border-navy-100 bg-white p-4 transition-colors duration-150 hover:border-water-600/20 md:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-water-600">
        <Waves className="h-4 w-4" />
        Salida
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Link href={user ? `/profile/${user.id}` : '#'} className="focus-ring rounded-full">
          <Avatar
            src={user?.avatar_url}
            name={user?.username ?? '?'}
            className="h-10 w-10"
          />
        </Link>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-navy-900">
            {user?.name || user?.username || 'Navegante'}
            {user?.verified_badge && <VerifiedBadge className="h-4 w-4" />}
          </p>
          <p className="truncate text-xs text-navy-400">
            {formatDay(activity.sailed_date)}
            {activity.sailing_class ? ` · ${activity.sailing_class}` : ''}
            {activity.boat ? ` · ${activity.boat.name}` : ''}
          </p>
        </div>
      </div>

      {/* Las millas son el número que se muestra; las horas acompañan. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {activity.distance_nm !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-water-50 px-3 py-1 text-sm font-bold tabular-nums text-water-600">
            <Sailboat className="h-4 w-4" />
            {nf.format(activity.distance_nm)} millas
          </span>
        )}
        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium tabular-nums text-navy-600">
          {activity.hours} h a bordo
        </span>
      </div>

      {activity.notes && (
        <p className="mt-3 max-w-prose text-sm whitespace-pre-wrap text-navy-700">
          {activity.notes}
        </p>
      )}

      {activity.crew_mates && (
        <p className="mt-2 text-xs text-navy-400">Con {activity.crew_mates}</p>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-navy-50 pt-2.5">
        <button
          type="button"
          onClick={toggleKudos}
          aria-pressed={mine}
          aria-label={mine ? 'Quitar aplauso' : 'Aplaudir esta salida'}
          style={{ touchAction: 'manipulation' }}
          className={`focus-ring flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors duration-150 ${
            mine
              ? 'bg-water-50 text-water-600'
              : 'text-navy-500 hover:bg-navy-50 hover:text-navy-800'
          }`}
        >
          <Hand className={`h-4 w-4 ${mine ? 'fill-current' : ''}`} />
          {kudos > 0 && <span className="tabular-nums">{kudos}</span>}
          <span className={kudos > 0 ? 'sr-only' : ''}>Aplaudir</span>
        </button>

        {/* El conteo cambia por acción de otros: hay que anunciarlo. */}
        <span aria-live="polite" className="sr-only">
          {kudos} {kudos === 1 ? 'aplauso' : 'aplausos'}
        </span>
      </div>
    </article>
  );
}
