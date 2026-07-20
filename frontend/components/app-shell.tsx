'use client';

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import {
  HomeIcon,
  BoatIcon,
  BellIcon,
  ShieldIcon,
  AnchorIcon,
  FlagIcon,
} from '@/components/nav-icons';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ active?: boolean; className?: string }>;
  badge?: number;
};

/** Ancho máximo del contenido según el tipo de página. */
const WIDTHS = {
  narrow: 'max-w-2xl', // formularios, auth
  default: 'max-w-5xl', // detalle, listas
  wide: 'max-w-6xl', // feed con columna lateral, admin
} as const;

function useNavItems(): NavItem[] {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!user) {
      setPending(0);
      return;
    }
    api
      .get('/api/crew/invitations')
      .then((res) => setPending(res.data.invitations.length))
      .catch(() => setPending(0));
  }, [user, pathname]);

  return [
    { href: '/home', label: 'Home', icon: HomeIcon },
    { href: '/regattas', label: 'Regatas', icon: FlagIcon },
    { href: '/boats', label: 'Barcos', icon: BoatIcon },
    { href: '/invitations', label: 'Alertas', icon: BellIcon, badge: pending },
    ...(isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }]
      : []),
    { href: '/profile', label: 'Perfil', icon: AnchorIcon },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return href === '/home'
    ? pathname === href || pathname === '/'
    : pathname.startsWith(href);
}

function Badge({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {value > 9 ? '9+' : value}
    </span>
  );
}

/** Sidebar fijo a la izquierda — solo en desktop (lg+). */
function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] flex-col border-r border-navy-100 bg-white lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/home" className="text-xl font-bold text-navy-900">
          ⚓ Navegantes
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-navy-800 text-white'
                  : 'text-navy-600 hover:bg-navy-50'
              }`}
            >
              <span className="relative">
                <Icon active={active} className="h-5 w-5" />
                <Badge value={badge ?? 0} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-navy-100 p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl p-2 hover:bg-navy-50"
          >
            <Avatar
              src={user.avatar_url}
              name={user.username}
              className="h-9 w-9 text-sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-navy-900">
                {user.name || user.username}
              </span>
              <span className="block truncate text-xs text-navy-400">
                @{user.username}
              </span>
            </span>
          </Link>
          <button
            onClick={() => {
              logout();
              router.replace('/auth/login');
            }}
            className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-navy-500 hover:bg-navy-50"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}

/** Bottom-nav fija — solo en móvil/tablet (< lg). */
function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 pb-safe backdrop-blur lg:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-2">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium ${
                active ? 'text-navy-800' : 'text-navy-400 hover:text-navy-600'
              }`}
            >
              <span className="relative">
                <Icon active={active} />
                <Badge value={badge ?? 0} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Layout raíz de las páginas autenticadas: navegación adaptativa
 * (sidebar en desktop, bottom-nav en móvil) + contenedor centrado y
 * acotado. `width` controla el ancho máximo del contenido.
 */
export function AppShell({
  children,
  width = 'default',
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  const items = useNavItems();

  return (
    <>
      <Sidebar items={items} />
      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-width)]">
        <main
          className={`mx-auto w-full flex-1 px-4 pt-6 pb-24 md:px-6 lg:px-8 lg:pt-10 lg:pb-12 ${WIDTHS[width]}`}
        >
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </>
  );
}
