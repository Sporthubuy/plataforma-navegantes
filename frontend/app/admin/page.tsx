'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { ACCOUNT_TYPE_LABEL } from '@/lib/format';
import type { AdminStats } from '@/lib/types';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm text-navy-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-navy-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api
      .get('/api/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => toast.error('No se pudieron cargar las métricas'));
  }, []);

  if (!stats) {
    return <p className="text-sm text-navy-400">Cargando métricas…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Usuarios totales" value={stats.total_users} />
        <StatCard label="Activos hoy" value={stats.active_today} />
        <StatCard label="Nuevos hoy" value={stats.new_today} />
        <StatCard label="Barcos" value={stats.total_boats} />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-navy-900">Por tipo de cuenta</h2>
          <div className="flex flex-col gap-2">
            {(Object.keys(stats.by_account_type) as Array<
              keyof typeof stats.by_account_type
            >).map((type) => (
              <div
                key={type}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-navy-600">
                  {ACCOUNT_TYPE_LABEL[type] ?? type}
                </span>
                <span className="font-semibold text-navy-900">
                  {stats.by_account_type[type]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-navy-900">Por estado</h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-600">Activos</span>
              <span className="font-semibold text-emerald-600">
                {stats.by_status.active}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-navy-600">Suspendidos</span>
              <span className="font-semibold text-red-600">
                {stats.by_status.suspended}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Link
          href="/admin/users"
          className="flex-1 rounded-xl bg-navy-800 px-4 py-3 text-center font-semibold text-white hover:bg-navy-700"
        >
          Gestionar usuarios
        </Link>
        <Link
          href="/admin/boats"
          className="flex-1 rounded-xl border border-navy-200 bg-white px-4 py-3 text-center font-semibold text-navy-700 hover:bg-navy-50"
        >
          Gestionar barcos
        </Link>
      </div>
    </div>
  );
}
