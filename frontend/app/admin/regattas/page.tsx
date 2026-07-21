'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import { RegattaStatusBadge } from '@/components/regatta/status-badge';
import { formatDateRange } from '@/lib/format';
import type { Regatta } from '@/lib/types';

export default function AdminRegattasPage() {
  const { hasPermission } = useAuth();
  const [regattas, setRegattas] = useState<Regatta[] | null>(null);

  useEffect(() => {
    api
      .get('/api/regattas', { params: { limit: 100 } })
      .then((res) => setRegattas(res.data.regattas))
      .catch(() => {
        setRegattas([]);
        toast.error('No se pudieron cargar las regatas');
      });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-900">Regatas</h2>
        {hasPermission('regattas.create') && (
          <Link href="/admin/regattas/new" className={buttonClasses('primary', 'sm')}>
            + Crear regata
          </Link>
        )}
      </div>

      {regattas === null ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : regattas.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-3xl">🏁</p>
          <p className="mt-2 text-sm text-navy-500">Todavía no hay regatas.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {regattas.map((r) => (
            <Link
              key={r.id}
              href={`/admin/regattas/${r.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">{r.name}</p>
                <p className="truncate text-xs text-navy-400">
                  {(r.classes ?? []).map((c) => c.sailing_class).join(', ') ||
                    'sin clases'}{' '}
                  · {formatDateRange(r.start_date, r.end_date)} ·{' '}
                  {r.entry_count ?? 0} inscriptos
                </p>
              </div>
              <RegattaStatusBadge status={r.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
