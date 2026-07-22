'use client';

import Link from 'next/link';
import { ProfileSection } from './profile-section';
import type { ProfileWithCv } from '@/lib/types';

interface CompletionItem {
  label: string;
  done: boolean;
  href: string;
}

/**
 * Tarjeta estilo LinkedIn "Completa tu perfil" que muestra un % y una
 * lista de pasos pendientes. Frontend-only: calcula el progreso en
 * base a los datos del perfil completo (ProfileWithCv).
 */
export function ProfileCompleteness({ profile }: { profile: ProfileWithCv }) {
  const items: CompletionItem[] = [
    { label: 'Foto de perfil', done: !!profile.avatar_url, href: '/profile' },
    { label: 'Nombre completo', done: !!profile.name, href: '/profile' },
    { label: 'Bio', done: !!profile.bio, href: '/profile' },
    { label: 'Clase de vela', done: !!profile.sailing_class, href: '/profile' },
    { label: 'Rol habitual', done: !!profile.usual_role, href: '/profile' },
    { label: 'Ubicación', done: !!(profile.country && profile.city), href: '/profile' },
    { label: 'Club', done: !!profile.club_id, href: '/profile' },
    { label: 'Titular profesional', done: !!profile.professional_summary?.headline, href: '/profile' },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const pending = items.filter((i) => !i.done);

  // Si está completo al 100% no tiene sentido mostrar el cartel.
  if (pending.length === 0) return null;

  return (
    <ProfileSection title="Completá tu perfil">
      <div className="flex items-center gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle
              cx="18" cy="18" r="15.5"
              fill="none" stroke="#e0e4ea" strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none" stroke="#0A7C8A" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
            />
          </svg>
          <span className="absolute text-[10px] font-bold text-navy-900">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy-800">
            Tu perfil está al {pct}%.
          </p>
          <p className="text-xs text-navy-500">
            Los perfiles completos reciben 3× más mensajes y aparecen primeros en las búsquedas.
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {pending.slice(0, 4).map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm text-navy-700 transition hover:bg-navy-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-navy-200 text-navy-300">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </span>
              {item.label}
            </Link>
          </li>
        ))}
        {pending.length > 4 && (
          <li className="text-xs text-navy-400">
            +{pending.length - 4} más por completar
          </li>
        )}
      </ul>
    </ProfileSection>
  );
}