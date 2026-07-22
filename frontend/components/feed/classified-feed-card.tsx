import Link from 'next/link';
import { formatLocation } from '@/lib/geo';
import { Megaphone, MapPin, Globe2 } from 'lucide-react';
import { isRecent } from '@/lib/format';
import type { Classified, ClassifiedCategory } from '@/lib/types';

const CATEGORY_LABEL: Record<ClassifiedCategory, string> = {
  tripulante: 'Busca tripulante',
  profesor: 'Busca profesor',
  barco: 'Ofrece barco',
  otro: 'Otro',
};

const CATEGORY_STYLE: Record<ClassifiedCategory, string> = {
  tripulante: 'bg-water-50 text-water-600',
  profesor: 'bg-sand-100 text-sand-700',
  barco: 'bg-sage-100 text-sage-700',
  otro: 'bg-navy-100 text-navy-700',
};

/** Clasificado dentro del feed. */
export function FeedClassifiedCard({ classified }: { classified: Classified }) {
  const chips = (classified.requirements ?? []).slice(0, 4);

  return (
    <article className="animate-[fadeIn_300ms_ease-out] rounded-xl border border-navy-100 bg-white p-4 transition duration-150 hover:border-water-600/20 hover:shadow-md md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-water-600">
          <Megaphone className="h-4 w-4" />
          Clasificado
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLE[classified.category]}`}
        >
          {CATEGORY_LABEL[classified.category]}
        </span>
        {isRecent(classified.created_at) && (
          <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
            Nuevo
          </span>
        )}
      </div>

      <Link href={`/classifieds/${classified.id}`} className="mt-2 block">
        <h2 className="font-bold text-navy-900">{classified.title}</h2>
      </Link>

      <p className="mt-1 flex items-center gap-1 text-xs text-navy-500">
        {classified.location_worldwide ? (
          <>
            <Globe2 className="h-3.5 w-3.5" />
            En cualquier lugar
          </>
        ) : (
          <>
            <MapPin className="h-3.5 w-3.5" />
            {formatLocation(classified.city, classified.country)}
          </>
        )}
      </p>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((r, i) => (
            <span
              key={`${r.requirement_type}-${r.requirement_value}-${i}`}
              className="rounded-full bg-navy-50 px-2 py-0.5 text-xs text-navy-600"
            >
              {r.requirement_value}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/classifieds/${classified.id}`}
        className="mt-3 inline-block text-sm font-semibold text-water-600 hover:underline"
      >
        Ver clasificado →
      </Link>
    </article>
  );
}
