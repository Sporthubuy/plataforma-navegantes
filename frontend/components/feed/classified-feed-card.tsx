import Link from 'next/link';
import { formatLocation } from '@/lib/geo';
import { MapPin, Globe2, ArrowRight } from 'lucide-react';
import { isRecent } from '@/lib/format';
import type { Classified, ClassifiedCategory } from '@/lib/types';
import { FeedItemShell } from './feed-item-shell';

const CATEGORY_LABEL: Record<ClassifiedCategory, string> = {
  tripulante: 'Busca tripulante',
  profesor: 'Busca profesor',
  barco: 'Ofrece barco',
  otro: 'Otro',
};

const CATEGORY_BADGE: Record<ClassifiedCategory, string> = {
  tripulante: 'bg-water-50 text-water-600',
  profesor: 'bg-sand-100 text-sand-700',
  barco: 'bg-sage-100 text-sage-700',
  otro: 'bg-navy-100 text-navy-700',
};

export function FeedClassifiedCard({ classified }: { classified: Classified }) {
  const chips = (classified.requirements ?? []).slice(0, 4);
  const badgeStyle = CATEGORY_BADGE[classified.category];
  const author = classified.author;

  return (
    <FeedItemShell
      typeStyle={{
        label: 'Clasificado',
        badge: badgeStyle,
      }}
      actor={
        author
          ? {
              name: author.name || `@${author.username}`,
              username: author.username,
              avatar_url: author.avatar_url,
              headline: CATEGORY_LABEL[classified.category],
              href: undefined,
            }
          : {
              name: CATEGORY_LABEL[classified.category],
              headline: undefined,
              avatar_url: null,
            }
      }
    >
      <Link href={`/classifieds/${classified.id}`} className="block">
        <h2 className="text-[15px] font-semibold leading-snug text-navy-950">{classified.title}</h2>
      </Link>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-navy-500">
        {isRecent(classified.created_at) && (
          <span className="rounded-full bg-sage-100 px-1.5 py-0.5 text-[10px] font-semibold text-sage-700">Nuevo</span>
        )}
        <span className="inline-flex items-center gap-1">
          {classified.location_worldwide ? (
            <>
              <Globe2 className="h-3.5 w-3.5" />
              <span>En cualquier lugar</span>
            </>
          ) : (
            <>
              <MapPin className="h-3.5 w-3.5" />
              <span>{formatLocation(classified.city, classified.country)}</span>
            </>
          )}
        </span>
      </div>

      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.map((r, i) => (
            <span
              key={`${r.requirement_type}-${r.requirement_value}-${i}`}
              className="rounded-full bg-navy-50 px-1.5 py-0.5 text-[10px] text-navy-600"
            >
              {r.requirement_value}
            </span>
          ))}
        </div>
      )}

      <Link
        href={`/classifieds/${classified.id}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-water-600 transition-all hover:gap-1.5 hover:underline"
      >
        Ver clasificado
        <ArrowRight className="h-3 w-3" />
      </Link>
    </FeedItemShell>
  );
}