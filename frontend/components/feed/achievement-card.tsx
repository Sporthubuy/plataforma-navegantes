import Link from 'next/link';
import { Trophy, ArrowRight } from 'lucide-react';
import type { RegattaHistoryItem } from '@/lib/types';
import { FeedItemShell } from './feed-item-shell';

const TYPE_STYLE = {
  label: 'Resultado',
  badge: 'bg-sand-100 text-sand-700',
};

const MEDAL = ['🥇', '🥈', '🥉'];

export function AchievementCard({ item }: { item: RegattaHistoryItem }) {
  const podium = item.position != null && item.position <= 3;
  const medal = podium ? MEDAL[item.position! - 1] : null;

  return (
    <FeedItemShell
      typeStyle={TYPE_STYLE}
      actor={{
        name: item.regatta_name,
        headline: item.sailing_class,
        avatar_url: null,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-100 text-base"
          aria-hidden="true"
        >
          {medal ?? <Trophy className="h-4 w-4 text-navy-300" />}
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-navy-950">
            {item.position != null && `${item.position}º`}
            {item.total_entries ? (
              <span className="ml-1 text-sm font-normal text-navy-500">de {item.total_entries}</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-navy-500">
            {item.sailing_class}
            {item.boat_name ? ` · ${item.boat_name}` : ''}
          </p>
        </div>
      </div>

      <Link
        href={`/regattas/${item.regatta_id}`}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-water-600 transition-colors duration-150 hover:underline"
      >
        Ver resultados
        <ArrowRight className="h-3 w-3" />
      </Link>
    </FeedItemShell>
  );
}