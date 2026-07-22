'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Field, Select } from '@/components/ui/input';
import { TalentCard } from '@/components/cv/talent-card';
import { EmptyState, SailingAloneIllustration } from '@/components/empty-state';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { COUNTRIES, citiesOf } from '@/lib/geo';
import {
  AVAILABILITY_LABEL,
  AVAILABILITY_STATUSES,
  type SearchResult,
} from '@/lib/types';

/** Qué se puede buscar. Coincide con `seeking_role` del backend. */
const SEARCH_TYPES = [
  { value: '', label: 'Cualquiera' },
  { value: 'tripulante', label: 'Tripulantes' },
  { value: 'entrenador', label: 'Entrenadores' },
  { value: 'socio_de_regata', label: 'Socios de regata' },
];

interface Filters {
  type: string;
  sailingClass: string;
  availability: string;
  country: string;
  city: string;
  verified: boolean;
}

const EMPTY_FILTERS: Filters = {
  type: '',
  sailingClass: '',
  availability: '',
  country: '',
  city: '',
  verified: false,
};

export default function TalentPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const set = (changes: Partial<Filters>) =>
    setFilters((current) => ({ ...current, ...changes }));

  const search = useCallback(() => {
    const params: Record<string, string> = {};
    if (filters.type) params.type = filters.type;
    if (filters.sailingClass) params.class = filters.sailingClass;
    if (filters.availability) params.availability = filters.availability;
    if (filters.country) params.country = filters.country;
    if (filters.city) params.city = filters.city;
    if (filters.verified) params.verified = 'true';

    api
      .get('/api/search', { params })
      .then((res) => setResults(res.data.results))
      .catch(() => setResults([]));
  }, [filters]);

  useEffect(search, [search]);

  const cities = filters.country ? citiesOf(filters.country) : [];
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900 md:text-3xl">
          <Users className="h-6 w-6 text-water-600" />
          Buscar tripulación
        </h1>
        <p className="mt-1 text-sm text-navy-500">
          Navegantes y entrenadores que se ofrecieron. Primero los
          verificados y los que más regatas navegaron.
        </p>

        <div className="mt-5 grid gap-3 rounded-2xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Busco">
            <Select
              value={filters.type}
              onChange={(e) => set({ type: e.target.value })}
            >
              {SEARCH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Clase">
            <Select
              value={filters.sailingClass}
              onChange={(e) => set({ sailingClass: e.target.value })}
            >
              <option value="">Cualquier clase</option>
              {BOAT_CATEGORIES.filter((c) => c !== 'Otra').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Disponibilidad">
            <Select
              value={filters.availability}
              onChange={(e) => set({ availability: e.target.value })}
            >
              <option value="">Cualquiera</option>
              {AVAILABILITY_STATUSES.map((a) => (
                <option key={a} value={a}>
                  {AVAILABILITY_LABEL[a]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="País">
            <Select
              value={filters.country}
              // Cambiar de país invalida la ciudad elegida.
              onChange={(e) => set({ country: e.target.value, city: '' })}
            >
              <option value="">Cualquier país</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ciudad">
            <Select
              value={filters.city}
              disabled={!filters.country || cities.length === 0}
              onChange={(e) => set({ city: e.target.value })}
            >
              <option value="">
                {filters.country ? 'Todo el país' : 'Elegí el país primero'}
              </option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </Field>

          <label className="flex items-end gap-2 pb-2.5 text-sm font-medium text-navy-800">
            <input
              type="checkbox"
              checked={filters.verified}
              onChange={(e) => set({ verified: e.target.checked })}
              className="h-4 w-4 accent-navy-700"
            />
            Solo perfiles verificados
          </label>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="focus-ring mt-2 rounded-lg text-sm font-semibold text-water-600 hover:underline"
          >
            Limpiar filtros
          </button>
        )}

        <div className="mt-5">
          {results === null ? (
            <p className="text-sm text-navy-400">Buscando…</p>
          ) : results.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              subtitle="Nadie coincide con esos filtros. Probá ampliar la búsqueda: solo aparecen los navegantes que completaron su perfil profesional."
              icon={<SailingAloneIllustration />}
              actions={[{ label: 'Completar mi perfil', href: '/profile' }]}
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-navy-500">
                {results.length}{' '}
                {results.length === 1 ? 'navegante' : 'navegantes'}
              </p>
              <div className="flex flex-col gap-3">
                {results.map((r) => (
                  <TalentCard key={r.profile.id} result={r} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
