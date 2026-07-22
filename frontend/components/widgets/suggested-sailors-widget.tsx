'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/cv/cv-sections';
import { Widget, WidgetEmpty } from './widget-shell';
import type { SearchResult } from '@/lib/types';

/**
 * Sugerencias de navegantes para conectar. Reutiliza /api/search sin
 * filtros (backend ya ordena verificados primero y por regatas
 * navegadas), recorta a 3 y ofrece un atajo a /messages para escribirle.
 */
export function SuggestedSailorsWidget() {
  const [people, setPeople] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    api
      .get('/api/search', { params: { limit: 3 } })
      .then((res) => setPeople(res.data.results ?? []))
      .catch(() => setPeople([]));
  }, []);

  return (
    <Widget title="A quién seguir" icon={UserPlus} seeAllHref="/explore">
      {people === null ? (
        <p className="text-xs text-navy-400">Cargando…</p>
      ) : people.length === 0 ? (
        <WidgetEmpty
          text="Todavía no hay sugerencias. Completá tu perfil náutico para recibir recomendaciones."
          actionLabel="Completar perfil"
          actionHref="/profile"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {people.map((r) => {
            const p = r.profile;
            return (
              <li key={p.id} className="flex items-center gap-2.5">
                <Link href={`/profile/${p.id}`} className="shrink-0">
                  <Avatar
                    src={p.avatar_url}
                    name={p.username}
                    className="h-9 w-9 text-sm"
                  />
                </Link>
                <Link
                  href={`/profile/${p.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="flex items-center gap-1 truncate text-sm font-semibold text-navy-900">
                    <span className="truncate">{p.name || p.username}</span>
                    {p.verified_badge && <VerifiedBadge className="h-3.5 w-3.5" />}
                  </p>
                  <p className="truncate text-xs text-navy-400">
                    @{p.username}
                    {r.achievement_stats?.total_regattas_sailed
                      ? ` · ${r.achievement_stats.total_regattas_sailed} regatas`
                      : ''}
                  </p>
                </Link>
                <Link
                  href={`/messages?to=${p.id}`}
                  className="shrink-0 rounded-full border border-navy-200 px-2.5 py-1 text-[11px] font-semibold text-navy-700 transition hover:border-navy-300 hover:bg-navy-50"
                >
                  Mensaje
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}