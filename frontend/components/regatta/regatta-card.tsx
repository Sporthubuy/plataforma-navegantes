import Link from 'next/link';
import { RegattaStatusBadge } from './status-badge';
import { formatDateRange } from '@/lib/format';
import type { Regatta } from '@/lib/types';

export function RegattaCard({ regatta }: { regatta: Regatta }) {
  return (
    <Link
      href={`/regattas/${regatta.id}`}
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md"
    >
      {regatta.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={regatta.photo_url}
          alt={regatta.name}
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-navy-300 to-navy-600 text-4xl">
          ⛵
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-bold text-navy-900">{regatta.name}</h3>
        </div>
        <RegattaStatusBadge status={regatta.status} />
        <dl className="mt-3 flex flex-col gap-1 text-sm text-navy-500">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-navy-700">
              {regatta.sailing_class}
            </span>
            {regatta.location && <span>· {regatta.location}</span>}
          </div>
          <div>{formatDateRange(regatta.start_date, regatta.end_date)}</div>
        </dl>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-navy-400">
          <span className="font-semibold text-navy-600">
            {regatta.entry_count ?? 0}
          </span>
          {(regatta.entry_count ?? 0) === 1 ? 'inscripto' : 'inscriptos'}
          {regatta.max_entries ? ` · cupo ${regatta.max_entries}` : ''}
        </div>
      </div>
    </Link>
  );
}
