import Link from 'next/link';
import { RegattaStatusBadge } from './status-badge';
import { formatDateRange } from '@/lib/format';
import type { Regatta } from '@/lib/types';

export function RegattaCard({ regatta }: { regatta: Regatta }) {
  const classes = regatta.classes ?? [];
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
        <h3 className="mb-2 font-bold text-navy-900">{regatta.name}</h3>
        <RegattaStatusBadge status={regatta.status} />

        {/* Clases del campeonato */}
        {classes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {classes.map((c) => (
              <span
                key={c.id}
                className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-medium text-navy-700"
                title={`${c.entry_count ?? 0} inscriptos`}
              >
                {c.sailing_class}
                <span className="ml-1 text-navy-400">{c.entry_count ?? 0}</span>
              </span>
            ))}
          </div>
        )}

        <dl className="mt-3 flex flex-col gap-1 text-sm text-navy-500">
          {regatta.location && <div>{regatta.location}</div>}
          <div>{formatDateRange(regatta.start_date, regatta.end_date)}</div>
        </dl>

        <div className="mt-3 text-xs text-navy-400">
          <span className="font-semibold text-navy-600">
            {classes.length}
          </span>{' '}
          {classes.length === 1 ? 'clase' : 'clases'} ·{' '}
          <span className="font-semibold text-navy-600">
            {regatta.entry_count ?? 0}
          </span>{' '}
          {(regatta.entry_count ?? 0) === 1 ? 'inscripto' : 'inscriptos'}
        </div>
      </div>
    </Link>
  );
}
