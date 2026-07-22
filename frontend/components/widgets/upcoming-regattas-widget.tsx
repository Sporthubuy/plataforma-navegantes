'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Widget, WidgetEmpty } from './widget-shell';
import { formatShortDate } from '@/lib/format';
import type { Regatta } from '@/lib/types';

export function UpcomingRegattasWidget({ regattas }: { regattas: Regatta[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = regattas
    .filter((r) => r.status !== 'cancelled' && r.end_date >= today)
    .slice(0, 3);

  return (
    <Widget title="Próximas regatas" icon={CalendarDays} seeAllHref="/regattas">
      {upcoming.length === 0 ? (
        <WidgetEmpty
          text="No hay regatas programadas."
          actionLabel="Explorar regatas"
          actionHref="/regattas"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((r) => (
            <li key={r.id}>
              <Link
                href={`/regattas/${r.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-water-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy-900">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-navy-400">
                    {formatShortDate(r.start_date)}
                    {r.classes?.[0] ? ` · ${r.classes[0].sailing_class}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
