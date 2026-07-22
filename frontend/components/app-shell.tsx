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
  ClassifiedIcon,
  CompassIcon,
  CrewIcon,
  SettingsIcon,
  MoreIcon,
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
    if (!user) return;
    api
      .get('/api/crew/invitations')
      .then((res) => setPending(res.data.invitations.length))
      .catch(() => setPending(0));
  }, [user, pathname]);

  return [
    { href: '/home', label: 'Home', icon: HomeIcon },
    { href: '/explore', label: 'Explorar', icon: CompassIcon },
    { href: '/regattas', label: 'Regatas', icon: FlagIcon },
    { href: '/classifieds', label: 'Clasificados', icon: ClassifiedIcon },
    { href: '/talent', label: 'Tripulación', icon: CrewIcon },
    { href: '/boats', label: 'Barcos', icon: BoatIcon },
    { href: '/invitations', label: 'Alertas', icon: BellIcon, badge: pending },
    ...(isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }]
      : []),
    { href: '/profile', label: 'Perfil', icon: AnchorIcon },
    { href: '/settings', label: 'Ajustes', icon: SettingsIcon },
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
      <div className="flex h-20 items-center px-6">
        <Link href="/home" className="flex items-center gap-3 text-lg font-bold tracking-tight text-navy-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-base text-white">⚓</span>
          Navegantes
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-navy-400">Explorar</p>
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-navy-600 hover:bg-water-50 hover:text-water-600'
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

/**
 * Top-bar fija — solo en móvil/tablet (< lg). Estructura tipo LinkedIn:
 * avatar a la izquierda, logo al medio y notificaciones a la derecha.
 */
function MobileTopBar({ notifications }: { notifications: number }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const alertsActive = isActive(pathname, '/invitations');

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-navy-100 bg-white/95 pt-safe backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link
          href="/profile"
          aria-label="Mi perfil"
          className="focus-ring rounded-full"
        >
          {user ? (
            <Avatar
              src={user.avatar_url}
              name={user.username}
              className="h-9 w-9 text-sm"
            />
          ) : (
            <span className="block h-9 w-9 rounded-full bg-navy-100" />
          )}
        </Link>

        <Link
          href="/home"
          className="focus-ring absolute left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg text-base font-bold tracking-tight text-navy-950"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-navy-900 text-sm text-white">
            ⚓
          </span>
          Navegantes
        </Link>

        <Link
          href="/invitations"
          aria-label={
            notifications > 0
              ? `Notificaciones (${notifications} sin leer)`
              : 'Notificaciones'
          }
          className={`focus-ring relative rounded-xl p-1.5 ${
            alertsActive ? 'text-water-600' : 'text-navy-500 hover:bg-navy-50'
          }`}
        >
          <BellIcon active={alertsActive} className="h-6 w-6" />
          <Badge value={notifications} />
        </Link>
      </div>
    </header>
  );
}

/** Bottom-nav fija — solo en móvil/tablet (< lg). */
function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const primaryItems = items.slice(0, 4);
  const secondaryItems = items.slice(4);

  return (
    <>
      {isMoreOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-navy-950/25 lg:hidden"
          onClick={() => setIsMoreOpen(false)}
        />
      )}
      {isMoreOpen && (
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 rounded-2xl border border-navy-100 bg-white p-2 shadow-xl lg:hidden">
          {secondaryItems.map(({ href, label, icon: Icon, badge }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsMoreOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-navy-700 hover:bg-water-50"
            >
              <span className="relative"><Icon className="h-5 w-5" /><Badge value={badge ?? 0} /></span>
              {label}
            </Link>
          ))}
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 pb-safe shadow-[0_-8px_24px_rgba(20,38,61,0.06)] backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-1">
        {primaryItems.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 text-xs font-medium ${
                active ? 'text-water-600' : 'text-navy-400 hover:text-navy-700'
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
          <button
            type="button"
            onClick={() => setIsMoreOpen((current) => !current)}
            className={`focus-ring flex min-w-[3.5rem] flex-col items-center gap-0.5 px-1 py-1 text-[11px] font-semibold ${isMoreOpen ? 'text-water-600' : 'text-navy-400'}`}
            aria-expanded={isMoreOpen}
          >
            <MoreIcon active={isMoreOpen} />
            Más
          </button>
        </div>
      </nav>
    </>
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
  const notifications =
    items.find((i) => i.href === '/invitations')?.badge ?? 0;

  // En móvil, perfil y alertas viven en la top-bar: no se repiten abajo.
  const mobileItems = items.filter(
    (i) => i.href !== '/profile' && i.href !== '/invitations'
  );

  return (
    <>
      <Sidebar items={items} />
      <MobileTopBar notifications={notifications} />
      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-width)]">
        <main
          className={`mx-auto w-full flex-1 px-4 pt-mobile-header pb-24 md:px-6 lg:px-8 lg:pt-10 lg:pb-12 ${WIDTHS[width]}`}
        >
          {children}
        </main>
      </div>
      <BottomNav items={mobileItems} />
    </>
  );
}
