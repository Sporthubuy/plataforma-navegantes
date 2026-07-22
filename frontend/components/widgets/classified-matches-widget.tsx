'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Widget, WidgetEmpty } from './widget-shell';
import type { Classified } from '@/lib/types';

interface MatchRow {
  id: string;
  classified_id: string;
  match_score: number;
  classified?: Classified;
}

/** Verde si el match es fuerte, ámbar si es medio. */
function scoreColor(score: number): string {
  return score > 70 ? 'bg-sage-700' : 'bg-sand-700';
}

export function ClassifiedMatchesWidget() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);

  useEffect(() => {
    api
      .get('/api/classifieds/matches/mine', { params: { limit: 3 } })
      .then((res) => setMatches(res.data.matches))
      .catch(() => setMatches([]));
  }, []);

  return (
    <Widget title="Sugerencias para ti" icon={Sparkles} seeAllHref="/classifieds">
      {matches === null ? (
        <p className="text-xs text-navy-400">Cargando…</p>
      ) : matches.length === 0 ? (
        <WidgetEmpty
          text="No hay sugerencias aún. Completa tu perfil náutico."
          actionLabel="Editar perfil"
          actionHref="/profile"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((m) => (
            <li key={m.id}>
              <Link
                href={`/classifieds/${m.classified_id}`}
                className="block rounded-lg px-2 py-1.5 hover:bg-water-50"
              >
                <span className="block truncate text-sm font-medium text-navy-900">
                  {m.classified?.title ?? 'Clasificado'}
                </span>
                <span className="block truncate text-xs text-navy-400">
                  {m.classified?.category}
                  {m.classified?.location ? ` · ${m.classified.location}` : ''}
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy-100">
                    <span
                      className={`block h-full rounded-full ${scoreColor(m.match_score)}`}
                      style={{ width: `${Math.min(100, m.match_score)}%` }}
                    />
                  </span>
                  <span className="text-[10px] font-semibold text-navy-500">
                    {Math.round(m.match_score)}%
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
