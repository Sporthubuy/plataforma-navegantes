'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Anchor,
  Building2,
  Flag,
  Megaphone,
  Users,
  Waves,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
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

/** Atajo a una sección del panel. `permission` lo oculta si no lo tenés. */
function SectionLink({
  href,
  label,
  icon: Icon,
  permission,
}: {
  href: string;
  label: string;
  icon: typeof Users;
  permission?: string;
}) {
  const { hasPermission } = useAuth();
  if (permission && !hasPermission(permission)) return null;
  return (
    <Link
      href={href}
      className="focus-ring flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-4 font-semibold text-navy-800 transition hover:border-water-600/30 hover:bg-water-50"
    >
      <Icon className="h-5 w-5 text-water-600" />
      {label}
    </Link>
  );
}

const nf = new Intl.NumberFormat('es-UY', { maximumFractionDigits: 1 });

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
        <StatCard
          label="Usuarios"
          value={stats.total_users}
          hint={`${stats.new_this_week} nuevos esta semana`}
        />
        <StatCard label="Activos hoy" value={stats.active_today} />
        <StatCard label="Barcos" value={stats.total_boats} />
        <StatCard label="Clubes" value={stats.total_clubs} />
        <StatCard label="Publicaciones" value={stats.total_posts} />
        <StatCard
          label="Clasificados activos"
          value={stats.active_classifieds}
        />
        <StatCard label="Regatas en curso" value={stats.live_regattas} />
        <StatCard
          label="Salidas"
          value={stats.total_outings}
          hint={`${nf.format(stats.total_miles)} millas en total`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-bold text-navy-900">Por tipo de cuenta</h2>
          <div className="flex flex-col gap-2">
            {(
              Object.keys(stats.by_account_type) as Array<
                keyof typeof stats.by_account_type
              >
            ).map((type) => (
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

      <section>
        <h2 className="mb-3 font-bold text-navy-900">Gestión</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SectionLink
            href="/admin/users"
            label="Usuarios"
            icon={Users}
            permission="users.view"
          />
          <SectionLink
            href="/admin/boats"
            label="Barcos"
            icon={Anchor}
            permission="boats.view_all"
          />
          <SectionLink href="/admin/regattas" label="Regatas" icon={Flag} />
          <SectionLink
            href="/admin/clubs"
            label="Clubes"
            icon={Building2}
          />
          <SectionLink
            href="/admin/content"
            label="Moderación"
            icon={Megaphone}
            permission="content.moderate"
          />
          <SectionLink
            href="/admin/content?tab=activities"
            label="Salidas"
            icon={Waves}
            permission="content.moderate"
          />
        </div>
      </section>
    </div>
  );
}
