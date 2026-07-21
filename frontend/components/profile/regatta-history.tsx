'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { RegattaHistoryItem } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

function PositionBadge({ item }: { item: RegattaHistoryItem }) {
  if (item.status !== 'finished' || item.position == null) {
    return (
      <span className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-500">
        {item.status === 'finished' ? 'Sin resultado' : 'En juego'}
      </span>
    );
  }
  const medal = item.position <= 3 ? MEDAL[item.position - 1] : '';
  const podium = item.position <= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
        podium ? 'bg-amber-100 text-amber-800' : 'bg-navy-100 text-navy-700'
      }`}
    >
      {medal} {item.position}º de {item.total_entries}
    </span>
  );
}

export function RegattaHistory({ userId }: { userId: string }) {
  const [history, setHistory] = useState<RegattaHistoryItem[] | null>(null);

  useEffect(() => {
    api
      .get(`/api/users/${userId}/regatta-history`)
      .then((res) => setHistory(res.data.history))
      .catch(() => setHistory([]));
  }, [userId]);

  if (history === null) {
    return <p className="text-sm text-navy-400">Cargando historial…</p>;
  }

  if (history.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-3xl">🏁</p>
        <p className="mt-2 text-sm text-navy-500">
          Todavía no participó en regatas.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {history.map((item) => (
        <Link
          key={item.entry_id}
          href={`/regattas/${item.regatta_id}`}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-xl">
            🏆
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-navy-900">
              {item.regatta_name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-navy-400">
              {/* La clase siempre visible: es la flota en la que corrió. */}
              <span className="rounded-full bg-navy-100 px-2 py-0.5 font-medium text-navy-700">
                {item.sailing_class}
              </span>
              <span className="truncate">
                {formatDate(item.start_date)}
                {item.boat_name ? ` · ${item.boat_name}` : ''}
              </span>
            </p>
          </div>
          <PositionBadge item={item} />
        </Link>
      ))}
    </div>
  );
}
