'use client';

import { useState } from 'react';
import { Briefcase, MapPin, Trash2 } from 'lucide-react';
import type { WorkExperience, WorkType } from '@/lib/types';
import { WORK_TYPE_LABEL } from '@/lib/types';

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

function formatDate(month: number | null, year: number | null): string {
  if (year == null) return '—';
  if (month == null) return String(year);
  return `${MONTHS[month - 1]} ${year}`;
}

function duration(startMonth: number | null, startYear: number, endMonth: number | null, endYear: number | null): string {
  const start = formatDate(startMonth, startYear);
  const end = endYear == null ? 'Actualidad' : formatDate(endMonth, endYear);
  return `${start} — ${end}`;
}

function typeColor(type: WorkType): string {
  const map: Record<WorkType, string> = {
    sailing_school: 'bg-water-50 text-water-600',
    club: 'bg-sage-100 text-sage-700',
    federation: 'bg-navy-100 text-navy-700',
    boatyard: 'bg-sand-100 text-sand-700',
    charter: 'bg-sand-100 text-sand-700',
    regatta_org: 'bg-water-50 text-water-600',
    other: 'bg-navy-100 text-navy-500',
  };
  return map[type] ?? 'bg-navy-100 text-navy-500';
}

function WorkRow({
  job,
  isOwner,
  onDelete,
}: {
  job: WorkExperience;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* Timeline line */}
      <span
        aria-hidden
        className="absolute top-9 bottom-0 left-[0.875rem] w-px bg-navy-100 last:hidden"
      />

      {/* Icon */}
      <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50">
        <Briefcase className="h-3.5 w-3.5 text-navy-500" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="font-semibold text-navy-900">{job.role}</p>
          {job.organization && (
            <p className="text-sm text-navy-600">· {job.organization}</p>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-navy-500">
          <span>{duration(job.start_month, job.start_year, job.end_month, job.end_year)}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${typeColor(job.work_type)}`}>
            {WORK_TYPE_LABEL[job.work_type]}
          </span>
          {job.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
        </div>

        {job.description && (
          <p className="mt-1 max-w-prose text-sm whitespace-pre-wrap text-navy-600 leading-relaxed">
            {job.description}
          </p>
        )}
      </div>

      {isOwner && (
        <button
          type="button"
          onClick={() => onDelete(job.id)}
          aria-label={`Borrar ${job.role}`}
          className="focus-ring h-7 shrink-0 rounded-lg p-1.5 text-navy-300 transition hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

export function WorkExperienceList({
  jobs,
  isOwner,
  onDelete,
}: {
  jobs: WorkExperience[];
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? jobs : jobs.slice(0, 5);

  if (jobs.length === 0) {
    return (
      <p className="text-sm text-navy-400">
        {isOwner
          ? 'Todavía no cargaste historial laboral en la industria náutica.'
          : 'Este navegante no publicó historial laboral.'}
      </p>
    );
  }

  return (
    <>
      <ol>
        {shown.map((job) => (
          <WorkRow key={job.id} job={job} isOwner={isOwner} onDelete={onDelete} />
        ))}
      </ol>

      {jobs.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="focus-ring mt-1 text-sm font-semibold text-water-600 hover:underline"
        >
          {expanded ? 'Ver menos' : `Ver los ${jobs.length} cargos`}
        </button>
      )}
    </>
  );
}