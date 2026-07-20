import Link from 'next/link';
import type { ReactNode } from 'react';

/** Layout de las pantallas previas al login: barra de marca + tarjeta centrada. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold text-navy-900">
            ⚓ Navegantes
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-navy-700"
            >
              Registro
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
