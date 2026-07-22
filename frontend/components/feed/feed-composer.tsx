'use client';

import Link from 'next/link';
import { Waves, Plus, Pencil, Anchor, Flag, Megaphone, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/avatar';

interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  permission?: string;
  /** La acción principal del inicio se destaca del resto. */
  highlight?: boolean;
}

/**
 * Composer compacto arriba del feed, estilo LinkedIn:
 *   [avatar]  Empezar una entrada…            [Publicar →]
 *   ───────────────────────────────────
 *   ✏️ Entrada    ⚓ Barco    🚩 Regata    📣 Clasificado    👥 Tripulación
 *
 * En vez de pills scrolleables, cada acción es un botón plano con
 * texto+icono alineado a la izquierda. En desktop se distribuyen con
 * flex-wrap; en mobile van en una fila con scroll horizontal sutil.
 */
export function FeedComposer({
  onNewPost,
  onNewActivity,
}: {
  onNewPost: () => void;
  onNewActivity: () => void;
}) {
  const { user, hasPermission } = useAuth();

  const actions: QuickAction[] = [
    // Registrar la salida es la acción que hace comunidad: va primera.
    { label: 'Salida', icon: Waves, onClick: onNewActivity, highlight: true },
    { label: 'Entrada', icon: Pencil, onClick: onNewPost },
    { label: 'Barco', icon: Anchor, href: '/boats/new' },
    {
      label: 'Regata',
      icon: Flag,
      href: '/admin/regattas/new',
      permission: 'regattas.create',
    },
    { label: 'Clasificado', icon: Megaphone, href: '/classifieds/new' },
    { label: 'Tripulación', icon: Users, href: '/explore?tab=tripulacion' },
  ].filter((a) => !a.permission || hasPermission(a.permission));

  return (
    <div className="rounded-xl border border-navy-100 bg-white p-4 md:p-5">
      {/* Fila superior: avatar + input-falso */}
      <div className="flex items-center gap-3">
        <Link href="/profile" className="shrink-0">
          {user ? (
            <Avatar
              src={user.avatar_url}
              name={user.username}
              className="h-11 w-11 text-base"
            />
          ) : (
            <span className="block h-11 w-11 rounded-full bg-navy-100" />
          )}
        </Link>
        <button
          type="button"
          onClick={onNewPost}
          className="flex h-11 flex-1 items-center rounded-full border border-navy-200 bg-white px-4 text-left text-sm text-navy-400 transition hover:border-navy-300 hover:bg-navy-50"
        >
          Empezar una entrada…
        </button>
      </div>

      {/* Divider */}
      <div className="my-3 border-t border-navy-50" />

      {/* Fila de acciones: botones planos con icono a la izquierda */}
      <div
        className="flex gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {actions.map(({ label, icon: Icon, href, onClick, highlight }) => {
          const content = highlight ? (
            // Registrar la salida es la acción principal del inicio.
            <span className="focus-ring flex shrink-0 items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy-800">
              <span className="relative flex items-center">
                <Icon className="h-4 w-4" />
                <Plus className="absolute -top-1.5 -right-2 h-3 w-3" />
              </span>
              {label}
            </span>
          ) : (
            <span className="focus-ring flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-700 transition hover:bg-navy-50">
              <Icon className="h-4 w-4 text-navy-500" />
              {label}
            </span>
          );
          return href ? (
            <Link key={label} href={href}>
              {content}
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="shrink-0 text-left"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}