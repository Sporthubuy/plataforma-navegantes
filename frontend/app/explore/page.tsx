'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { Field, Select } from '@/components/ui/input';
import { FeedRegattaCard } from '@/components/feed/regatta-card';
import { FeedClassifiedCard } from '@/components/feed/classified-feed-card';
import { TalentCard } from '@/components/cv/talent-card';
import { EmptyState, SailingAloneIllustration } from '@/components/empty-state';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { COUNTRIES, citiesOf } from '@/lib/geo';
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STATUSES,
  type Classified,
  type Regatta,
  type SearchResult,
  type UserSearchResult,
} from '@/lib/types';

type Tab = 'navegantes' | 'tripulacion' | 'regatas' | 'clasificados';

const TABS: { id: Tab; label: string }[] = [
  { id: 'navegantes', label: 'Navegantes' },
  { id: 'tripulacion', label: 'Tripulación' },
  { id: 'regatas', label: 'Regatas' },
  { id: 'clasificados', label: 'Clasificados' },
];

const SEARCH_TYPES = [
  { value: '', label: 'Cualquiera' },
  { value: 'tripulante', label: 'Tripulantes' },
  { value: 'entrenador', label: 'Entrenadores' },
  { value: 'socio_de_regata', label: 'Socios de regata' },
];

interface TalentFilters {
  type: string;
  sailingClass: string;
  availability: string;
  country: string;
  city: string;
  verified: boolean;
}

const EMPTY_TALENT_FILTERS: TalentFilters = {
  type: '',
  sailingClass: '',
  availability: '',
  country: '',
  city: '',
  verified: false,
};

export default function ExplorePage() {
  return (
    <Suspense fallback={<AppShell><p className="text-navy-400">Cargando…</p></AppShell>}>
      <ExploreContent />
    </Suspense>
  );
}

function ExploreContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // El tab inicial lo puede venir por ?tab=… (p. ej. desde el FAB de Tripulación).
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'navegantes';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [classifieds, setClassifieds] = useState<Classified[]>([]);

  // Tripulación (talent)
  const [filters, setFilters] = useState<TalentFilters>(EMPTY_TALENT_FILTERS);
  const [talentResults, setTalentResults] = useState<SearchResult[] | null>(null);

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

  // Búsqueda de navegantes con debounce.
  useEffect(() => {
    const q = query.trim();
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

  // Búsqueda de tripulación (filtros).
  const talentSearch = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.type) params.type = filters.type;
    if (filters.sailingClass) params.class = filters.sailingClass;
    if (filters.availability) params.availability = filters.availability;
    if (filters.country) params.country = filters.country;
    if (filters.city) params.city = filters.city;
    if (filters.verified) params.verified = 'true';
    api
      .get('/api/search', { params })
      .then((res) => setTalentResults(res.data.results))
      .catch(() => setTalentResults([]));
  }, [filters]);

  useEffect(() => {
    if (tab === 'tripulacion') talentSearch();
  }, [tab, talentSearch]);

  const cities = filters.country ? citiesOf(filters.country) : [];
  const hasTalentFilters = Object.values(filters).some(Boolean);
  const setTalent = (changes: Partial<TalentFilters>) =>
    setFilters((current) => ({ ...current, ...changes }));

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="sr-only">Explorar</h1>

        <div
          className="flex gap-2 overflow-x-auto"
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
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre de usuario…"
                  aria-label="Buscar navegantes"
                  className="w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                />
              </div>

              <p className="mt-2 text-xs text-navy-400">
                ¿Buscás por clase, zona o disponibilidad en vez de por nombre?{' '}
                <button
                  type="button"
                  onClick={() => setTab('tripulacion')}
                  className="font-semibold text-water-600 hover:underline"
                >
                  Usá el buscador de tripulación
                </button>
                .
              </p>

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
                      className="focus-ring flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-3 transition duration-150 hover:border-navy-200"
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

          {tab === 'tripulacion' && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-water-600" />
                <h2 className="text-sm font-bold text-navy-900">Buscar tripulación</h2>
              </div>
              <p className="mb-4 text-sm text-navy-500">
                Navegantes y entrenadores que se ofrecieron. Primero los
                verificados y los que más regatas navegaron.
              </p>

              <div className="grid gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Busco">
                  <Select
                    value={filters.type}
                    onChange={(e) => setTalent({ type: e.target.value })}
                  >
                    {SEARCH_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Clase">
                  <Select
                    value={filters.sailingClass}
                    onChange={(e) => setTalent({ sailingClass: e.target.value })}
                  >
                    <option value="">Cualquier clase</option>
                    {BOAT_CATEGORIES.filter((c) => c !== 'Otra').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Disponibilidad">
                  <Select
                    value={filters.availability}
                    onChange={(e) => setTalent({ availability: e.target.value })}
                  >
                    <option value="">Cualquiera</option>
                    {AVAILABILITY_STATUSES.map((a) => (
                      <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="País">
                  <Select
                    value={filters.country}
                    onChange={(e) => setTalent({ country: e.target.value, city: '' })}
                  >
                    <option value="">Cualquier país</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Ciudad">
                  <Select
                    value={filters.city}
                    disabled={!filters.country || cities.length === 0}
                    onChange={(e) => setTalent({ city: e.target.value })}
                  >
                    <option value="">
                      {filters.country ? 'Todo el país' : 'Elegí el país primero'}
                    </option>
                    {cities.map((city) => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </Select>
                </Field>

                <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-navy-800">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) => setTalent({ verified: e.target.checked })}
                    className="h-4 w-4 accent-navy-700"
                  />
                  Solo verificados
                </label>
              </div>

              {hasTalentFilters && (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_TALENT_FILTERS)}
                  className="focus-ring mt-2 rounded-lg text-sm font-semibold text-water-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}

              <div className="mt-5">
                {talentResults === null ? (
                  <p className="text-sm text-navy-400">Buscando…</p>
                ) : talentResults.length === 0 ? (
                  <EmptyState
                    title="Sin resultados"
                    subtitle="Nadie coincide con esos filtros. Probá ampliar la búsqueda: solo aparecen los navegantes que completaron su perfil profesional."
                    icon={<SailingAloneIllustration />}
                    actions={[{ label: 'Completar mi perfil', href: '/profile' }]}
                  />
                ) : (
                  <>
                    <p className="mb-3 text-sm text-navy-500">
                      {talentResults.length}{' '}
                      {talentResults.length === 1 ? 'navegante' : 'navegantes'}
                    </p>
                    <div className="flex flex-col gap-3">
                      {talentResults.map((r) => (
                        <TalentCard key={r.profile.id} result={r} />
                      ))}
                    </div>
                  </>
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