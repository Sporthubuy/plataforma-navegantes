import type { ReactNode } from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/avatar';

/**
 * Color del punto/badge de tipo. Cada tipo de feed-item define su
 * par `(label, dot)` — el dot es un color sólido para el badge.
 */
export type FeedTypeStyle = {
  label: string;
  /** Tailwind classes para el badge pequeño (bg + text). */
  badge: string;
};

export interface FeedHeaderActor {
  name: string | null;
  username?: string | null;
  avatar_url?: string | null;
  href?: string | null;
  /** Subtítulo: titular, club, etc. */
  headline?: string | null;
}

/**
 * Shell compacto tipo Twitter/X para todo item del feed.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ [avatar]  Nombre Apellido  [Regata] · headline · 2h  │
 *   │                                                          │
 *   │   Título destacado                                       │
 *   │   Subtítulo gris (máx 2 líneas con line-clamp)           │
 *   │   [link / preview]                                      │
 *   │                                                          │
 *   │   ♥ 12    💬 3    ↗ Compartir    🔖 Guardar             │
 *   └──────────────────────────────────────────────────────┘
 *
 * Layout horizontal: avatar a la izq (shrink-0) + columna flexible
 * a la derecha con todo el contenido. Paddings reducidos para que
 * entren más tarjetas por pantalla sin saturar.
 */
export function FeedItemShell({
  typeStyle,
  actor,
  time,
  accent = false,
  children,
  footer,
}: {
  typeStyle: FeedTypeStyle;
  actor?: FeedHeaderActor | null;
  time?: string;
  accent?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const actorName = actor?.name || (actor?.username ? `@${actor.username}` : null);

  return (
    <article
      className={`animate-[fadeIn_200ms_ease-out] rounded-xl border px-4 py-3 transition duration-150 hover:border-navy-200 md:px-5 ${
        accent
          ? 'border-water-600/30 bg-water-50/30'
          : 'border-navy-100 bg-white'
      }`}
    >
      <div className="flex gap-3">
        {/* Avatar a la izquierda */}
        {actor && (
          actor.href ? (
            <Link href={actor.href} className="shrink-0 pt-0.5">
              <Avatar
                src={actor.avatar_url ?? null}
                name={actor.username ?? actorName ?? actor.href}
                className="h-10 w-10 text-sm"
              />
            </Link>
          ) : (
            <div className="shrink-0 pt-0.5">
              <Avatar
                src={actor.avatar_url ?? null}
                name={actor.username ?? actorName ?? '?'}
                className="h-10 w-10 text-sm"
              />
            </div>
          )
        )}

        {/* Columna derecha: header + body + footer */}
        <div className="min-w-0 flex-1">
          {/* Header row: nombre + badge + headline + time */}
          <div className="flex items-center gap-1.5 text-sm leading-tight">
            {actorName && (
              actor?.href ? (
                <Link
                  href={actor.href}
                  className="truncate font-bold text-navy-950 hover:text-water-600 hover:underline"
                >
                  {actorName}
                </Link>
              ) : (
                <span className="truncate font-bold text-navy-950">{actorName}</span>
              )
            )}

            {/* Badge de categoría: pill pequeño con color */}
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${typeStyle.badge}`}
            >
              {typeStyle.label}
            </span>

            {actor?.headline && (
              <>
                <span className="text-navy-200">·</span>
                <span className="truncate text-xs text-navy-500">{actor.headline}</span>
              </>
            )}

            {time && (
              <>
                <span className="text-navy-200">·</span>
                <span className="ml-auto shrink-0 text-xs text-navy-400">{time}</span>
              </>
            )}
          </div>

          {/* Body libre según tipo */}
          <div className="mt-1.5">{children}</div>

          {/* Footer (action bar) opcional */}
          {footer && <div className="mt-2.5 border-t border-navy-50 pt-2">{footer}</div>}
        </div>
      </div>
    </article>
  );
}

/**
 * Botón de action bar compacto tipo Twitter/X con hover gris muy
 * sutil. Opcionalmente muestra un contador.
 */
export function FeedActionButton({
  icon,
  count,
  active = false,
  activeClass,
  onClick,
  href,
  ariaLabel,
  disabled = false,
}: {
  icon: ReactNode;
  count?: number;
  active?: boolean;
  activeClass?: string;
  onClick?: () => void;
  href?: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const cls = `focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-50 ${
    active && activeClass ? activeClass : 'text-navy-500'
  }`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cls}>
        {icon}
        {count != null && count > 0 && <span>{count}</span>}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cls} disabled={disabled}>
      {icon}
      {count != null && count > 0 && <span>{count}</span>}
    </button>
  );
}