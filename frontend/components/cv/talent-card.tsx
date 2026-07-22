'use client';

import Link from 'next/link';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from './cv-sections';
import { formatLocation } from '@/lib/geo';
import {
  AVAILABILITY_LABEL,
  SEEKING_ROLE_LABEL,
  type SearchResult,
} from '@/lib/types';

const AVAILABILITY_STYLE: Record<string, string> = {
  available: 'bg-sage-100 text-sage-700',
  selective: 'bg-sand-100 text-sand-700',
  not_available: 'bg-navy-100 text-navy-500',
};

/** Tarjeta de un navegante en los resultados de búsqueda. */
export function TalentCard({ result }: { result: SearchResult }) {
  const { profile, professional_summary: summary, achievement_stats: stats } = result;
  const place = formatLocation(profile.city, profile.country);
  const tags = [...new Set([...summary.specialties, ...summary.preferred_classes])];

  return (
    <Link
      href={`/profile/${profile.id}`}
      className="focus-ring block rounded-xl border border-navy-100 bg-white p-4 transition duration-150 hover:border-water-600/20 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={profile.avatar_url}
          name={profile.username}
          className="h-12 w-12 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-semibold text-navy-900">
            <span className="truncate">{profile.name || profile.username}</span>
            {profile.verified_badge && <VerifiedBadge className="h-4 w-4" />}
          </p>
          <p className="truncate text-xs text-navy-400">
            @{profile.username}
            {place ? ` · ${place}` : ''}
            {profile.club ? ` · ${profile.club.short_name ?? profile.club.name}` : ''}
          </p>

          {summary.headline && (
            <p className="mt-1.5 line-clamp-2 text-sm text-navy-700">
              {summary.headline}
            </p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            AVAILABILITY_STYLE[summary.availability_status]
          }`}
        >
          {AVAILABILITY_LABEL[summary.availability_status]}
        </span>
      </div>

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {/* La experiencia es lo que decide a quién contactar primero. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-navy-50 pt-2.5 text-xs text-navy-500">
        <span>
          <strong className="text-navy-900">{stats.total_regattas_sailed}</strong>{' '}
          {stats.total_regattas_sailed === 1 ? 'regata' : 'regatas'}
        </span>
        <span>
          <strong className="text-navy-900">{stats.total_podiums}</strong>{' '}
          {stats.total_podiums === 1 ? 'podio' : 'podios'}
        </span>
        {stats.best_class && <span>Mejor clase: {stats.best_class}</span>}
        {stats.verified_credentials_count > 0 && (
          <span className="inline-flex items-center gap-1 font-semibold text-water-600">
            <VerifiedBadge className="h-3.5 w-3.5" />
            {stats.verified_credentials_count}{' '}
            {stats.verified_credentials_count === 1 ? 'título' : 'títulos'}
          </span>
        )}
        {summary.seeking_role && (
          <span className="ml-auto text-water-600">
            {SEEKING_ROLE_LABEL[summary.seeking_role]}
          </span>
        )}
      </div>
    </Link>
  );
}
