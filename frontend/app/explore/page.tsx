'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Compass } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { Input } from '@/components/ui/input';
import { FeedRegattaCard } from '@/components/feed/regatta-card';
import { FeedClassifiedCard } from '@/components/feed/classified-feed-card';
import { EmptyState, SailingAloneIllustration } from '@/components/empty-state';
import type { Classified, Regatta, UserSearchResult } from '@/lib/types';

type Tab = 'navegantes' | 'regatas' | 'clasificados';

const TABS: { id: Tab; label: string }[] = [
  { id: 'navegantes', label: 'Navegantes' },
  { id: 'regatas', label: 'Regatas' },
  { id: 'clasificados', label: 'Clasificados' },
];

export default function ExplorePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('navegantes');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [classifieds, setClassifieds] = useState<Classified[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/regattas', { params: { limit: 12 } })
      .then((res) => setRegattas(res.data.regattas))
      .catch(() => setRegattas([]));
    api
      .get('/api/classifieds', { params: { limit: 12 } })
      .then((res) => setClassifieds(res.data.classifieds))
      .catch(() => setClassifieds([]));
  }, [user]);

  // Búsqueda de navegantes con debounce: el backend filtra por prefijo de username.
  useEffect(() => {
    const q = query.trim();
    // Con menos de 2 letras no se busca; la UI ya muestra la pista y no
    // llega a leer `results`, así que no hace falta limpiarlos acá.
    if (!user || q.length < 2) return;

    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get('/api/users/search', { params: { q } })
        .then((res) => setResults(res.data.users))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900 md:text-3xl">
          <Compass className="h-6 w-6 text-water-600" />
          Explorar
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Descubrí navegantes, regatas y oportunidades de la comunidad.
        </p>

        <div
          className="mt-5 flex gap-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition duration-200 ${
                tab === t.id
                  ? 'bg-water-600 text-white'
                  : 'border border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab === 'navegantes' && (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-navy-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre de usuario…"
                  aria-label="Buscar navegantes"
                  className="pl-9"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {query.trim().length < 2 ? (
                  <p className="text-sm text-navy-400">
                    Escribí al menos 2 letras del usuario que buscás.
                  </p>
                ) : searching ? (
                  <p className="text-sm text-navy-400">Buscando…</p>
                ) : results.length === 0 ? (
                  <EmptyState
                    title="Sin resultados"
                    subtitle={`No encontramos navegantes que empiecen con "${query.trim()}".`}
                    icon={<SailingAloneIllustration />}
                  />
                ) : (
                  results.map((u) => (
                    <Link
                      key={u.id}
                      href={`/profile/${u.id}`}
                      className="focus-ring flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-3 transition duration-150 hover:border-water-600/20 hover:shadow-md"
                    >
                      <Avatar
                        src={u.avatar_url}
                        name={u.username}
                        className="h-10 w-10"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy-900">
                          {u.name || u.username}
                        </p>
                        <Username username={u.username} className="text-xs" />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </>
          )}

          {tab === 'regatas' &&
            (regattas.length === 0 ? (
              <EmptyState
                title="Todavía no hay regatas"
                subtitle="Cuando se publique un campeonato lo vas a ver acá."
                actions={[{ label: 'Ver regatas', href: '/regattas' }]}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {regattas.map((r) => (
                  <FeedRegattaCard key={r.id} regatta={r} />
                ))}
              </div>
            ))}

          {tab === 'clasificados' &&
            (classifieds.length === 0 ? (
              <EmptyState
                title="Todavía no hay clasificados"
                subtitle="Publicá el tuyo y encontrá tripulación o barco."
                actions={[{ label: 'Publicar clasificado', href: '/classifieds/new' }]}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {classifieds.map((c) => (
                  <FeedClassifiedCard key={c.id} classified={c} />
                ))}
              </div>
            ))}
        </div>
      </div>
    </AppShell>
  );
}
