import Link from 'next/link';
import { Trophy } from 'lucide-react';
import type { RegattaHistoryItem } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

/** Resultado propio en una regata terminada. */
export function AchievementCard({ item }: { item: RegattaHistoryItem }) {
  const podium = item.position != null && item.position <= 3;
  const medal = podium ? MEDAL[item.position! - 1] : null;

  return (
    <article
      className={`animate-[fadeIn_300ms_ease-out] rounded-xl border p-4 transition duration-150 hover:shadow-md md:p-5 ${
        podium ? 'border-sand-700/25 bg-sand-100/50' : 'border-navy-100 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-sand-700">
        <Trophy className="h-4 w-4" />
        Tu resultado
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {medal ?? '🏁'}
        </span>
        <div className="min-w-0">
          <p className="font-bold text-navy-900">
            {item.position}º de {item.total_entries}
          </p>
          <p className="truncate text-xs text-navy-500">
            Resultado final en{' '}
            <span className="font-medium text-navy-700">{item.regatta_name}</span>{' '}
            · {item.sailing_class}
          </p>
        </div>
      </div>

      <Link
        href={`/regattas/${item.regatta_id}`}
        className="mt-3 inline-block text-sm font-semibold text-water-600 hover:underline"
      >
        Ver resultados →
      </Link>
    </article>
  );
}
