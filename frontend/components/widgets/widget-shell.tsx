import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

/**
 * Marco común de los widgets del sidebar: encabezado con icono,
 * título y un "Ver todo" opcional.
 */
export function Widget({
  title,
  icon: Icon,
  seeAllHref,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  seeAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-navy-100 bg-white p-4">
      <header className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-water-600" />
        <h2 className="flex-1 text-sm font-semibold text-navy-700">{title}</h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-xs font-medium text-water-600 hover:underline"
          >
            Ver todo
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** Mensaje corto para widgets sin datos, con acción opcional. */
export function WidgetEmpty({
  text,
  actionLabel,
  actionHref,
}: {
  text: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <p className="text-xs text-navy-400">
      {text}{' '}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="font-medium text-water-600 hover:underline"
        >
          {actionLabel}
        </Link>
      )}
    </p>
  );
}
