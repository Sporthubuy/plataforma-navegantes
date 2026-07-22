import Link from 'next/link';
import { CalendarDays, MapPin, ArrowRight } from 'lucide-react';
import { REGATTA_STATUS } from '@/components/regatta/status-badge';
import { formatDateRange } from '@/lib/format';
import { placeLabel } from '@/lib/geo';
import type { Regatta } from '@/lib/types';
import { FeedItemShell } from './feed-item-shell';

const TYPE_STYLE = {
  label: 'Regata',
  badge: 'bg-water-50 text-water-600',
};

export function FeedRegattaCard({ regatta }: { regatta: Regatta }) {
  const status = REGATTA_STATUS[regatta.status];
  const classes = regatta.classes ?? [];
  const isOpen = classes.some((c) => c.status === 'open');

  return (
    <FeedItemShell
      typeStyle={TYPE_STYLE}
      actor={{
        name: regatta.club?.name ?? regatta.name,
        headline: regatta.club?.short_name ?? placeLabel(regatta) ?? undefined,
        avatar_url: null,
      }}
    >
      <Link href={`/regattas/${regatta.id}`} className="block">
        <h2 className="text-[15px] font-semibold leading-snug text-navy-950">{regatta.name}</h2>
      </Link>

      <p className="mt-1 line-clamp-2 text-sm text-navy-500">
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDateRange(regatta.start_date, regatta.end_date)}
        </span>
        {placeLabel(regatta) && (
          <>
            <span className="mx-1 text-navy-200">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {placeLabel(regatta)}
            </span>
          </>
        )}
        <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.classes}`}>
          {status.label}
        </span>
      </p>

      {classes.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {classes.slice(0, 4).map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-water-50 px-1.5 py-0.5 text-[10px] font-medium text-water-600"
            >
              {c.sailing_class}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/regattas/${regatta.id}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-water-600 transition-all hover:gap-1.5 hover:underline"
      >
        {isOpen ? 'Inscribirse' : 'Ver detalle'}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </FeedItemShell>
  );
}