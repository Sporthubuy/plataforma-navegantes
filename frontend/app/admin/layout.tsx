'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';

const TABS = [
  { href: '/admin', label: 'Panel', exact: true },
  { href: '/admin/users', label: 'Usuarios', exact: false },
  { href: '/admin/boats', label: 'Barcos', exact: false },
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
      <main className="flex flex-1 items-center justify-center">
        <p className="text-navy-400">Cargando…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-24 md:pt-20">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-navy-900">Administración</h1>
          <p className="text-sm text-navy-500">Gestión de la plataforma</p>
        </header>

        <nav className="mb-6 flex gap-1 rounded-xl bg-white p-1 shadow-sm">
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
                  active
                    ? 'bg-navy-800 text-white'
                    : 'text-navy-600 hover:bg-navy-50'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </>
  );
}
