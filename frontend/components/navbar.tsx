'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z"
      />
    </svg>
  );
}

function AnchorIcon({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
    >
      <circle cx="12" cy="5" r="2.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5V21m0 0c-4.5 0-8-3-8.5-7M12 21c4.5 0 8-3 8.5-7M2 12.5 3.5 14M22 12.5 20.5 14M9 10.5h6"
      />
    </svg>
  );
}

export function Navbar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return null;

  if (!user) {
    return (
      <header className="fixed inset-x-0 top-0 z-20 border-b border-navy-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
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
    );
  }

  const items = [
    { href: '/home', label: 'Home', icon: HomeIcon },
    { href: '/profile', label: 'Perfil', icon: AnchorIcon },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-4 md:h-14 md:justify-between">
        <span className="hidden text-lg font-bold text-navy-900 md:block">
          ⚓ Navegantes
        </span>
        <div className="flex w-full items-center justify-around md:w-auto md:gap-6">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs font-medium md:flex-row md:gap-2 md:text-sm ${
                  active ? 'text-navy-800' : 'text-navy-400 hover:text-navy-600'
                }`}
              >
                <Icon active={active} />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
