import Link from 'next/link';
import { Sailboat, Waves } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/cv/cv-sections';
import type { CommunityActivity } from '@/lib/types';

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-UY', {
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Una salida en el feed del inicio. Es lo que hace comunidad: mostrar
 * que la gente sale a navegar, sin compararla con nadie.
 */
export function ActivityCard({ activity }: { activity: CommunityActivity }) {
  const user = activity.user;

  return (
    <article className="animate-[fadeIn_300ms_ease-out] rounded-xl border border-navy-100 bg-white p-4 transition duration-150 hover:border-water-600/20 hover:shadow-md md:p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-water-600">
        <Waves className="h-4 w-4" />
        Salida
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Link href={user ? `/profile/${user.id}` : '#'}>
          <Avatar
            src={user?.avatar_url}
            name={user?.username ?? '?'}
            className="h-10 w-10"
          />
        </Link>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-navy-900">
            {user?.name || user?.username || 'Navegante'}
            {user?.verified_badge && <VerifiedBadge className="h-4 w-4" />}
          </p>
          <p className="truncate text-xs text-navy-400">
            {formatDay(activity.sailed_date)}
            {activity.sailing_class ? ` · ${activity.sailing_class}` : ''}
            {activity.boat ? ` · ${activity.boat.name}` : ''}
          </p>
        </div>
      </div>

      {/* Las millas son el número que se muestra; las horas acompañan. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {activity.distance_nm !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-water-50 px-3 py-1 text-sm font-bold text-water-600">
            <Sailboat className="h-4 w-4" />
            {new Intl.NumberFormat('es-UY', {
              maximumFractionDigits: 1,
            }).format(activity.distance_nm)}{' '}
            millas
          </span>
        )}
        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-600">
          {activity.hours} h a bordo
        </span>
      </div>

      {activity.notes && (
        <p className="mt-3 max-w-prose text-sm whitespace-pre-wrap text-navy-700">
          {activity.notes}
        </p>
      )}

      {activity.crew_mates && (
        <p className="mt-2 text-xs text-navy-400">Con {activity.crew_mates}</p>
      )}
    </article>
  );
}
