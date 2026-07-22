import Link from 'next/link';
import { Flag, MapPin, CalendarDays } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { REGATTA_STATUS } from '@/components/regatta/status-badge';
import { formatDateRange } from '@/lib/format';
import type { Regatta } from '@/lib/types';

/** Regata próxima dentro del feed. */
export function FeedRegattaCard({ regatta }: { regatta: Regatta }) {
  const status = REGATTA_STATUS[regatta.status];
  const classes = regatta.classes ?? [];
  const isOpen = classes.some((c) => c.status === 'open');

  return (
    <article className="animate-[fadeIn_300ms_ease-out] rounded-xl border border-navy-100 bg-white p-4 transition duration-150 hover:border-water-600/20 hover:shadow-md md:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-water-600">
        <Flag className="h-4 w-4" />
        Regata
      </div>

      <h2 className="mt-2 font-bold text-navy-900">{regatta.name}</h2>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-navy-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDateRange(regatta.start_date, regatta.end_date)}
        </span>
        {regatta.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {regatta.location}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 font-medium ${status.classes}`}>
          {status.label}
        </span>
      </div>

      {classes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-water-50 px-2 py-0.5 text-xs font-medium text-water-600"
            >
              {c.sailing_class}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/regattas/${regatta.id}`}
          className={buttonClasses('secondary', 'sm')}
        >
          Ver detalle
        </Link>
        {isOpen && (
          <Link
            href={`/regattas/${regatta.id}`}
            className={buttonClasses('primary', 'sm')}
          >
            Inscribirse
          </Link>
        )}
      </div>
    </article>
  );
}
