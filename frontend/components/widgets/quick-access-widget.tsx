'use client';

import Link from 'next/link';
import { Zap, Anchor, Bell, User, Settings } from 'lucide-react';
import type { ComponentType } from 'react';
import { Widget } from './widget-shell';

export function QuickAccessWidget({ pendingInvites = 0 }: { pendingInvites?: number }) {
  const links: Array<{
    label: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { label: 'Agregar barco', href: '/boats/new', icon: Anchor },
    {
      label: 'Invitaciones',
      href: '/invitations',
      icon: Bell,
      badge: pendingInvites,
    },
    { label: 'Mi perfil', href: '/profile', icon: User },
    { label: 'Configuración', href: '/settings', icon: Settings },
  ];

  return (
    <Widget title="Accesos rápidos" icon={Zap}>
      <ul className="flex flex-col gap-1">
        {links.map(({ label, href, icon: Icon, badge }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-700 hover:bg-water-50 hover:text-water-600"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badge != null && badge > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Widget>
  );
}
