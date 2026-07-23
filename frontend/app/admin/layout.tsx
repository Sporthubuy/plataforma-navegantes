'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';

const TABS = [
  { href: '/admin', label: 'Panel', exact: true },
  { href: '/admin/users', label: 'Usuarios', exact: false },
  { href: '/admin/boats', label: 'Barcos', exact: false },
  { href: '/admin/regattas', label: 'Regatas', exact: false },
  { href: '/admin/clubs', label: 'Clubes', exact: false },
  { href: '/admin/content', label: 'Moderación', exact: false },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guardia: sin sesión → login; con sesión pero sin permisos → home.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/auth/login');
    } else if (!isAdmin) {
      router.replace('/home');
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return (
      <AppShell width="wide">
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell width="wide">
      {/* El nombre de la sección ya está en la navegación: el título
          queda solo para lectores de pantalla. */}
      <h1 className="sr-only">Administración</h1>

      <nav className="mb-6 flex max-w-md gap-1 rounded-xl bg-white p-1 shadow-sm">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                active ? 'bg-navy-800 text-white' : 'text-navy-600 hover:bg-navy-50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </AppShell>
  );
}
