import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonClasses, type ButtonVariant } from '@/components/ui/button';

export interface EmptyStateAction {
  label: string;
  href: string;
  variant?: ButtonVariant;
}

/**
 * Estado vacío ilustrado. Aparece con un fade-in suave para que no
 * "salte" cuando termina la carga.
 */
export function EmptyState({
  title,
  subtitle,
  icon,
  actions = [],
  compact = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: EmptyStateAction[];
  compact?: boolean;
}) {
  return (
    <div
      className={`animate-[fadeIn_300ms_ease-out] rounded-2xl border border-navy-100 bg-white text-center ${
        compact ? 'p-6' : 'p-8 md:p-12'
      }`}
    >
      {icon && <div className="mx-auto mb-4 w-fit">{icon}</div>}
      <h3 className="font-bold text-navy-900">{title}</h3>
      {subtitle && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-navy-500">{subtitle}</p>
      )}
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className={buttonClasses(a.variant ?? 'primary', 'sm')}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Ilustraciones (flat, paleta navy/water; sin dependencias) ───── */

/** Mar en calma: horizonte con olas suaves y un sol bajo. */
export function CalmSeaIllustration() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" aria-hidden="true">
      <circle cx="88" cy="30" r="14" fill="#e2ebf4" />
      <path
        d="M4 56c10 0 10-6 20-6s10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 12 6"
        stroke="#94b5d4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M4 70c10 0 10-6 20-6s10 6 20 6 10-6 20-6 10 6 20 6 10-6 20-6 10 6 12 6"
        stroke="#c3d6e8"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M52 44V16l18 20-18 8Z" fill="#3d6da0" />
      <path d="M48 44V22l-12 14 12 8Z" fill="#94b5d4" />
      <path d="M36 46h34l-5 8H41l-5-8Z" fill="#223c5b" />
    </svg>
  );
}

/** Amarre vacío: un noray sin barco. */
export function NoBoatsIllustration() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" aria-hidden="true">
      <rect x="14" y="58" width="92" height="8" rx="4" fill="#e2ebf4" />
      <rect x="30" y="34" width="14" height="24" rx="4" fill="#94b5d4" />
      <rect x="26" y="28" width="22" height="8" rx="4" fill="#3d6da0" />
      <path
        d="M52 40c14 4 26 4 40 0"
        stroke="#c3d6e8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <rect x="76" y="34" width="14" height="24" rx="4" fill="#94b5d4" />
      <rect x="72" y="28" width="22" height="8" rx="4" fill="#3d6da0" />
      <path
        d="M8 74c12 0 12-5 24-5s12 5 24 5 12-5 24-5 12 5 24 5"
        stroke="#c3d6e8"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Navegar en solitario: un timón y una silueta sola. */
export function SailingAloneIllustration() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" fill="none" aria-hidden="true">
      <circle cx="60" cy="40" r="22" stroke="#94b5d4" strokeWidth="4" fill="#f5f8fa" />
      <circle cx="60" cy="40" r="7" fill="#3d6da0" />
      <g stroke="#3d6da0" strokeWidth="4" strokeLinecap="round">
        <path d="M60 12v8M60 60v8M32 40h8M80 40h8" />
        <path d="M40 20l6 6M80 60l-6-6M40 60l6-6M80 20l-6 6" />
      </g>
      <path
        d="M8 76c12 0 12-5 24-5s12 5 24 5 12-5 24-5 12 5 24 5"
        stroke="#c3d6e8"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
