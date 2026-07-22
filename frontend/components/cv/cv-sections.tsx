'use client';

import { Award, BadgeCheck, ExternalLink, Trash2 } from 'lucide-react';
import {
  AVAILABILITY_LABEL,
  CREDENTIAL_TYPE_LABEL,
  SEEKING_ROLE_LABEL,
  type AchievementStats,
  type Credential,
  type ProfessionalSummary,
} from '@/lib/types';

export function VerifiedBadge({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <BadgeCheck
      className={`${className} shrink-0 text-water-600`}
      aria-label="Perfil verificado"
    />
  );
}

export function CertifiedCoachBanner({
  credentials,
}: {
  credentials: Credential[];
}) {
  const certified = credentials.find(
    (c) =>
      c.is_verified &&
      (c.credential_type === 'instructor' || c.credential_type === 'coach')
  );
  if (!certified) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-sage-200 bg-sage-50 p-4">
      <Award className="mt-0.5 h-5 w-5 shrink-0 text-sage-700" />
      <div className="min-w-0">
        <p className="font-bold text-sage-900">Entrenador certificado</p>
        <p className="text-sm text-sage-800">
          {certified.title}
          {certified.issuer ? ` · ${certified.issuer}` : ''}
        </p>
      </div>
    </div>
  );
}

export function CvStats({ stats }: { stats: AchievementStats }) {
  const cells: { value: string; label: string }[] = [
    {
      value: String(stats.total_regattas_sailed),
      label: stats.total_regattas_sailed === 1 ? 'Regata' : 'Regatas',
    },
    { value: String(stats.total_1st_places), label: 'Primeros puestos' },
    { value: String(stats.total_podiums), label: 'Podios' },
    stats.sailing_since_year
      ? { value: String(stats.sailing_since_year), label: 'Navegando desde' }
      : { value: '—', label: 'Navegando desde' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="rounded-xl border border-navy-100 bg-white p-3 text-center"
        >
          <p className="text-2xl font-bold text-navy-900">{cell.value}</p>
          <p className="text-xs text-navy-400">{cell.label}</p>
        </div>
      ))}
      {stats.best_class && (
        <p className="col-span-2 text-xs text-navy-500 sm:col-span-4">
          Mejor clase: <strong className="text-navy-800">{stats.best_class}</strong>
          {stats.total_podiums > 0 &&
            ` · ${stats.total_podiums} ${stats.total_podiums === 1 ? 'podio' : 'podios'}`}
        </p>
      )}
    </div>
  );
}

export function CvSpecialties({ summary }: { summary: ProfessionalSummary }) {
  const availabilityStyle: Record<string, string> = {
    available: 'bg-sage-100 text-sage-700',
    selective: 'bg-sand-100 text-sand-700',
    not_available: 'bg-navy-100 text-navy-500',
  };

  const tags = [...new Set([...summary.specialties, ...summary.preferred_classes])];
  if (tags.length === 0 && !summary.seeking_role) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            availabilityStyle[summary.availability_status]
          }`}
        >
          {AVAILABILITY_LABEL[summary.availability_status]}
        </span>
        {summary.seeking_role && (
          <span className="rounded-full bg-water-50 px-2.5 py-1 text-xs font-semibold text-water-600">
            {SEEKING_ROLE_LABEL[summary.seeking_role]}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full border border-navy-100 bg-white px-2.5 py-1 text-xs font-medium text-navy-700"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatCredentialDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es', {
    month: 'short',
    year: 'numeric',
  });
}

export function CvCredentials({
  credentials,
  isOwner,
  onDelete,
}: {
  credentials: Credential[];
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <ul className="flex flex-col gap-2">
      {credentials.map((c) => {
        const expired = c.expiry_date !== null && c.expiry_date < today;
        return (
          <li
            key={c.id}
            className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 font-semibold text-navy-900">
                {c.title}
                {c.is_verified && <VerifiedBadge className="h-4 w-4" />}
                {expired && (
                  <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-500">
                    Vencido
                  </span>
                )}
              </p>
              <p className="text-sm text-navy-500">
                {CREDENTIAL_TYPE_LABEL[c.credential_type]}
                {c.issuer ? ` · ${c.issuer}` : ''}
              </p>
              <p className="text-xs text-navy-400">
                {c.issue_date && `Emitido ${formatCredentialDate(c.issue_date)}`}
                {c.expiry_date
                  ? ` · Vence ${formatCredentialDate(c.expiry_date)}`
                  : c.issue_date
                    ? ' · No vence'
                    : ''}
              </p>
              {c.credential_url && (
                <a
                  href={c.credential_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-water-600 hover:underline"
                >
                  Ver certificado
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                aria-label={`Borrar ${c.title}`}
                className="focus-ring rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
