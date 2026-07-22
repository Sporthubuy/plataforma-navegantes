'use client';

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, BADGE_REFRESH_EVENT } from '@/lib/api';
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
  MessageIcon,
  SettingsIcon,
  MoreIcon,
} from '@/components/nav-icons';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ active?: boolean; className?: string }>;
  badge?: number;
};

const WIDTHS = {
  narrow: 'max-w-2xl',
  default: 'max-w-5xl',
  wide: 'max-w-6xl',
} as const;

function useNavItems(): NavItem[] {
  const { user, isAdmin } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get('/api/messages/unread')
      .catch(() => null)
      .then((messages) => {
        if (cancelled) return;
        setUnread(messages?.data.unread ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname, refreshKey]);

  useEffect(() => {
    const bump = () => setRefreshKey((n) => n + 1);
    window.addEventListener(BADGE_REFRESH_EVENT, bump);
    return () => window.removeEventListener(BADGE_REFRESH_EVENT, bump);
  }, []);

  // Navegación primaria simplificada (5 items + admin si aplica).
  return [
    { href: '/home', label: 'Home', icon: HomeIcon },
    { href: '/explore', label: 'Explorar', icon: CompassIcon },
    { href: '/regattas', label: 'Regatas', icon: FlagIcon },
    { href: '/messages', label: 'Mensajes', icon: MessageIcon, badge: unread },
    ...(isAdmin
      ? [{ href: '/admin', label: 'Admin', icon: ShieldIcon }]
      : []),
  ];
}

/** Items secundarios: viven en el dropdown "Me" y en el "Más" móvil. */
function useSecondaryItems(): NavItem[] {
  const { user } = useAuth();
  const pathname = usePathname();
  const [pending, setPending] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/crew/invitations')
      .then((res) => setPending(res.data.invitations.length))
      .catch(() => setPending(0));
  }, [user, pathname, refreshKey]);

  useEffect(() => {
    const bump = () => setRefreshKey((n) => n + 1);
    window.addEventListener(BADGE_REFRESH_EVENT, bump);
    return () => window.removeEventListener(BADGE_REFRESH_EVENT, bump);
  }, []);

  return [
    { href: '/profile', label: 'Mi perfil', icon: AnchorIcon },
    { href: '/boats', label: 'Mis barcos', icon: BoatIcon },
    { href: '/invitations', label: 'Alertas', icon: BellIcon, badge: pending },
    { href: '/classifieds', label: 'Clasificados', icon: ClassifiedIcon },
    { href: '/talent', label: 'Tripulación', icon: CrewIcon },
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
    <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
      {value > 9 ? '9+' : value}
    </span>
  );
}

/** Fila de logo + campana, como LinkedIn (top of sidebar). */
function BrandRow({ alertsActive, alertsBadge }: { alertsActive: boolean; alertsBadge: number }) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-navy-50 px-4">
      <Link href="/home" className="flex items-center gap-2 text-base font-bold tracking-tight text-navy-950">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-900 text-xs text-white">⚓</span>
        Navegantes
      </Link>
      <Link
        href="/invitations"
        aria-label={alertsBadge > 0 ? `Notificaciones (${alertsBadge})` : 'Notificaciones'}
        className={`focus-ring relative rounded-lg p-1.5 ${alertsActive ? 'text-water-600' : 'text-navy-500 hover:bg-navy-50'}`}
      >
        <BellIcon active={alertsActive} className="h-5 w-5" />
        <Badge value={alertsBadge} />
      </Link>
    </div>
  );
}

/** Card "Me" con dropdown, tipo LinkedIn. Click afuera lo cierra. */
function MeCard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  const items = [
    { href: '/profile', label: 'Mi perfil' },
    { href: '/boats', label: 'Mis barcos' },
    { href: '/settings', label: 'Ajustes' },
  ];

  return (
    <div className="relative border-t border-navy-100 p-2" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((c) => !c)}
        className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-navy-50"
        aria-expanded={open}
      >
        <Avatar src={user.avatar_url} name={user.username} className="h-8 w-8 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-navy-900">
            {user.name || user.username}
          </span>
          <span className="block truncate text-xs text-navy-400">Ver menú</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-navy-400" fill="none" stroke="currentColor" strokeWidth={2.4}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 bottom-full mb-2 rounded-xl border border-navy-100 bg-white p-1.5 shadow-lg">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              {it.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
              router.replace('/auth/login');
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const secondary = useSecondaryItems();
  const alertsActive = isActive(pathname, '/invitations');
  const alertsBadge = secondary.find((i) => i.href === '/invitations')?.badge ?? 0;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] flex-col border-r border-navy-100 bg-white lg:flex">
      <BrandRow alertsActive={alertsActive} alertsBadge={alertsBadge} />
      <nav className="flex flex-1 flex-col gap-0.5 px-2 py-3">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-water-50 text-water-600 font-semibold'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-navy-800'
              }`}
            >
              <span className="relative flex items-center justify-center">
                <Icon active={active} className="h-4.5 w-4.5" />
                <Badge value={badge ?? 0} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>
      <MeCard />
    </aside>
  );
}

function MobileTopBar({ notifications }: { notifications: number }) {
  const { user } = useAuth();
  const alertsActive = isActive(usePathname(), '/invitations');

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
          aria-label={notifications > 0 ? `Notificaciones (${notifications} sin leer)` : 'Notificaciones'}
          className={`focus-ring relative rounded-xl p-1.5 ${alertsActive ? 'text-water-600' : 'text-navy-500 hover:bg-navy-50'}`}
        >
          <BellIcon active={alertsActive} className="h-6 w-6" />
          <Badge value={notifications} />
        </Link>
      </div>
    </header>
  );
}

function BottomNav({ primaryItems, secondaryItems }: { primaryItems: NavItem[]; secondaryItems: NavItem[] }) {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 pb-safe shadow-[0_-2px_8px_rgba(20,38,61,0.04)] backdrop-blur lg:hidden">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-around px-1">
        {primaryItems.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-w-[3rem] flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium ${
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
            className={`focus-ring flex min-w-[3.5rem] flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-semibold ${isMoreOpen ? 'text-water-600' : 'text-navy-400'}`}
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

export function AppShell({
  children,
  width = 'default',
}: {
  children: ReactNode;
  width?: keyof typeof WIDTHS;
}) {
  const items = useNavItems();
  const secondary = useSecondaryItems();
  const notifications = secondary.reduce((total, i) => total + (i.badge ?? 0), 0);

  return (
    <>
      <Sidebar items={items} />
      <MobileTopBar notifications={notifications} />
      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-width)]">
        <main
          className={`mx-auto w-full flex-1 px-4 pt-mobile-header pb-24 md:px-6 lg:px-8 lg:pt-8 lg:pb-12 ${WIDTHS[width]}`}
        >
          {children}
        </main>
      </div>
      <BottomNav primaryItems={items} secondaryItems={secondary} />
    </>
  );
}