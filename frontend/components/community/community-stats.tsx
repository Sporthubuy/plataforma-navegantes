'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { UserCheck, UserPlus } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

export interface CommunityStatsData {
  followers_count: number;
  following_count: number;
  outings_count: number;
  total_nm: number;
  total_hours: number;
  last_sailed_date: string | null;
}

/** Redondea las millas: 32.5 se lee mejor que 32.5000. */
function formatMiles(value: number): string {
  return new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 }).format(value);
}

/**
 * Números de comunidad del perfil. Reemplazan al bloque de trayectoria
 * (regatas, 1ros, podios): miden participación, no ranking, así que
 * nadie queda comparado contra nadie.
 */
export function CommunityStats({
  userId,
  stats,
}: {
  userId: string;
  stats: CommunityStatsData;
}) {
  const cells = [
    {
      value: String(stats.followers_count),
      label: stats.followers_count === 1 ? 'Seguidor' : 'Seguidores',
      href: `/profile/${userId}/followers`,
    },
    {
      value: String(stats.outings_count),
      label: stats.outings_count === 1 ? 'Salida' : 'Salidas',
    },
    {
      value: formatMiles(stats.total_nm),
      label: 'Millas náuticas',
    },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2">
      {cells.map((cell) => {
        const content = (
          <>
            <dt className="text-lg font-bold text-navy-900">{cell.value}</dt>
            <dd className="text-[11px] text-navy-400">{cell.label}</dd>
          </>
        );
        return cell.href ? (
          <Link
            key={cell.label}
            href={cell.href}
            className="focus-ring rounded-lg py-1 text-center transition hover:bg-navy-50"
          >
            {content}
          </Link>
        ) : (
          <div key={cell.label} className="py-1 text-center">
            {content}
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Seguir / dejar de seguir. Optimista: el botón responde al toque y se
 * revierte solo si el backend rechaza.
 */
export function FollowButton({
  userId,
  onChange,
}: {
  userId: string;
  onChange?: () => void;
}) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/api/community/following-state/${userId}`)
      .then((res) => setFollowing(res.data.following))
      .catch(() => setFollowing(false));
  }, [userId]);

  useEffect(load, [load]);

  async function toggle() {
    if (following === null || busy) return;
    const previous = following;
    setFollowing(!previous);
    setBusy(true);
    try {
      if (previous) {
        await api.delete(`/api/community/follow/${userId}`);
      } else {
        await api.post(`/api/community/follow/${userId}`);
      }
      onChange?.();
    } catch (err) {
      setFollowing(previous);
      toast.error(getApiError(err, 'No se pudo actualizar'));
    } finally {
      setBusy(false);
    }
  }

  if (following === null) return null;

  return (
    <Button
      size="sm"
      variant={following ? 'secondary' : 'primary'}
      onClick={toggle}
      disabled={busy}
      className="flex-1"
    >
      {following ? (
        <>
          <UserCheck className="h-4 w-4" />
          Siguiendo
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Seguir
        </>
      )}
    </Button>
  );
}
