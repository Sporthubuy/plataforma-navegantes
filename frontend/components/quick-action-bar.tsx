'use client';

import Link from 'next/link';
import { Pencil, Anchor, Flag, Megaphone, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '@/lib/auth-context';

interface QuickAction {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  onClick?: () => void;
  /** Si está definido, la acción solo se muestra con ese permiso. */
  permission?: string;
}

/**
 * Barra de acciones rápidas, sticky bajo el encabezado del feed.
 * En desktop muestra icono + texto; en móvil scrollea horizontal.
 *
 * Los permisos solo deciden QUÉ se muestra: la autoridad sigue siendo
 * el backend, que valida cada acción por su cuenta.
 */
export function QuickActionBar({ onNewPost }: { onNewPost: () => void }) {
  const { hasPermission } = useAuth();

  const actions: QuickAction[] = [
    { label: 'Nueva entrada', icon: Pencil, onClick: onNewPost },
    { label: 'Agregar barco', icon: Anchor, href: '/boats/new' },
    {
      label: 'Crear regata',
      icon: Flag,
      href: '/admin/regattas/new',
      permission: 'regattas.create',
    },
    // El alta de clasificado ya tiene su propia página con el formulario
    // completo: no se duplica en un modal.
    { label: 'Publicar clasificado', icon: Megaphone, href: '/classifieds/new' },
    {
      label: 'Buscar tripulación',
      icon: Users,
      href: '/classifieds?category=tripulante',
    },
  ].filter((a) => !a.permission || hasPermission(a.permission));

  const pill =
    'focus-ring flex shrink-0 items-center gap-2 rounded-full border border-navy-100 bg-white px-3.5 py-2 text-sm font-semibold text-navy-700 shadow-sm transition duration-200 hover:border-water-600/30 hover:bg-water-50 hover:text-water-600';

  return (
    // En móvil se pega justo debajo de la top-bar; en desktop, arriba de todo.
    <div className="sticky top-mobile-header z-20 -mx-4 mb-5 border-b border-navy-100/70 bg-white/80 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6 lg:top-0 lg:-mx-8 lg:px-8">
      <div
        className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible"
        style={{ scrollbarWidth: 'none' }}
      >
        {actions.map(({ label, icon: Icon, href, onClick }) =>
          href ? (
            <Link key={label} href={href} className={pill} title={label}>
              <Icon className="h-4 w-4" />
              {/* En móvil solo el icono: el título hace de tooltip. */}
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ) : (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={pill}
              title={label}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
