import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import type { Classified, ClassifiedCategory } from '@/lib/types';

const CATEGORY_STYLES: Record<ClassifiedCategory, string> = {
  tripulante: 'bg-sky-100 text-sky-800',
  profesor: 'bg-emerald-100 text-emerald-800',
  barco: 'bg-amber-100 text-amber-800',
  otro: 'bg-violet-100 text-violet-800',
};

const CATEGORY_LABELS: Record<ClassifiedCategory, string> = {
  tripulante: 'Tripulante',
  profesor: 'Profesor',
  barco: 'Barco',
  otro: 'Otro',
};

function daysSince(date: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  return days === 0 ? 'Hoy' : `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function categoryLabel(category: ClassifiedCategory): string {
  return CATEGORY_LABELS[category];
}

export function ClassifiedCard({ classified }: { classified: Classified }) {
  const author = classified.author;
  return (
    <Link
      href={`/classifieds/${classified.id}`}
      className="focus-ring group flex min-h-[250px] flex-col rounded-2xl border border-navy-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-navy-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${CATEGORY_STYLES[classified.category]}`}>
          {CATEGORY_LABELS[classified.category]}
        </span>
        <span className="text-xs font-medium text-navy-400">{daysSince(classified.created_at)}</span>
      </div>
      <h2 className="mt-4 line-clamp-2 text-lg font-bold leading-tight text-navy-900 group-hover:text-navy-700">
        {classified.title}
      </h2>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-navy-600">{classified.description}</p>
      <div className="mt-4 flex items-center gap-2 text-sm text-navy-500">
        <span aria-hidden="true">⌖</span>
        <span className="truncate">{classified.location_worldwide ? 'Todo el mundo' : classified.location}</span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3">
        <span className="flex min-w-0 items-center gap-2 text-xs font-semibold text-navy-600">
          <Avatar src={author?.avatar_url} name={author?.username ?? '?'} className="h-7 w-7 text-[11px]" />
          <span className="truncate">@{author?.username ?? 'navegante'}</span>
        </span>
        {classified.interest_count !== undefined && (
          <span className="text-xs font-semibold text-navy-500">
            {classified.interest_count} interesado{classified.interest_count === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </Link>
  );
}