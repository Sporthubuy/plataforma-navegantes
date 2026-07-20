'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { RegattaCard } from '@/components/regatta/regatta-card';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import type { Regatta } from '@/lib/types';

export default function RegattasPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [regattas, setRegattas] = useState<Regatta[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sailingClass, setSailingClass] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const fetchRegattas = useCallback(async () => {
    try {
      const res = await api.get('/api/regattas', {
        params: {
          search: search.trim() || undefined,
          status: status || undefined,
          sailing_class: sailingClass || undefined,
          limit: 50,
        },
      });
      setRegattas(res.data.regattas);
    } catch {
      setRegattas([]);
      toast.error('No se pudieron cargar las regatas');
    }
  }, [search, status, sailingClass]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(fetchRegattas, 250);
    return () => clearTimeout(t);
  }, [user, fetchRegattas]);

  if (loading || !user) {
    return (
      <AppShell width="wide">
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  const selectClass = 'text-sm';

  return (
    <AppShell width="wide">
      <h1 className="mb-5 text-2xl font-bold text-navy-900 md:text-3xl">
        Regatas
      </h1>

      <div className="mb-6 flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar regata…"
          className="rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
        />
        <div className="flex flex-wrap gap-2">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`w-auto ${selectClass}`}
          >
            <option value="">Todos los estados</option>
            <option value="upcoming">Próximas</option>
            <option value="open">Inscripciones abiertas</option>
            <option value="in_progress">En curso</option>
            <option value="finished">Finalizadas</option>
            <option value="cancelled">Canceladas</option>
          </Select>
          <Select
            value={sailingClass}
            onChange={(e) => setSailingClass(e.target.value)}
            className={`w-auto ${selectClass}`}
          >
            <option value="">Todas las clases</option>
            {BOAT_CATEGORIES.filter((c) => c !== 'Otra').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {regattas === null ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : regattas.length === 0 ? (
        <Card className="p-8 text-center md:p-10">
          <p className="text-4xl">🏁</p>
          <h2 className="mt-3 font-semibold text-navy-900">
            No hay regatas
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            No se encontraron regatas con esos filtros.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {regattas.map((r) => (
            <RegattaCard key={r.id} regatta={r} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
