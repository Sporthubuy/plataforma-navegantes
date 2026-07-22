'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, PenLine, Trash2 } from 'lucide-react';
import type { AchievementType, RegattaAchievement } from '@/lib/types';

/** Medalla del puesto. Del 4º para abajo, un punto neutro. */
function positionMedal(position: number | null, type: AchievementType): string {
  if (position === 1 || type === '1st_place') return '🥇';
  if (position === 2 || type === '2nd_place') return '🥈';
  if (position === 3 || type === '3rd_place') return '🥉';
  return '⛵';
}

function formatYear(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es', {
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Una entrada del historial. Distingue a simple vista los logros que
 * generó la app (tienen autoridad: salen de resultados cargados) de los
 * que declaró el navegante a mano.
 */
function AchievementRow({
  achievement,
  isOwner,
  onDelete,
}: {
  achievement: RegattaAchievement;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const podium =
    achievement.position !== null && achievement.position <= 3;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {/* Línea de la timeline */}
      <span
        aria-hidden
        className="absolute top-9 bottom-0 left-[1.05rem] w-px bg-navy-100 last:hidden"
      />

      <span
        className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
          podium ? 'bg-sand-100' : 'bg-navy-50'
        }`}
      >
        {positionMedal(achievement.position, achievement.achievement_type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {achievement.regatta_id ? (
            <Link
              href={`/regattas/${achievement.regatta_id}`}
              className="font-semibold text-navy-900 hover:text-water-600 hover:underline"
            >
              {achievement.regatta_name}
            </Link>
          ) : (
            <span className="font-semibold text-navy-900">
              {achievement.regatta_name}
            </span>
          )}

          {achievement.is_manual ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-500"
              title="Historial declarado por el navegante, anterior a la plataforma"
            >
              <PenLine className="h-3 w-3" />
              Declarado
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700"
              title="Generado desde los resultados oficiales de la plataforma"
            >
              <BadgeCheck className="h-3 w-3" />
              Verificado
            </span>
          )}
        </div>

        <p className="mt-0.5 text-sm text-navy-600">
          {achievement.position !== null && (
            <strong className="font-semibold text-navy-900">
              {achievement.position}º
              {achievement.total_entries ? ` de ${achievement.total_entries}` : ''}
            </strong>
          )}
          {achievement.position !== null && achievement.regatta_class ? ' · ' : ''}
          {achievement.regatta_class}
        </p>

        <p className="mt-0.5 text-xs text-navy-400">
          {formatYear(achievement.regatta_date)}
          {achievement.boat_name ? ` · ${achievement.boat_name}` : ''}
        </p>

        {achievement.notes && (
          <p className="mt-1 text-sm text-navy-500 italic">{achievement.notes}</p>
        )}
      </div>

      {/* Los automáticos no se borran: romperían la trazabilidad. */}
      {isOwner && achievement.is_manual && (
        <button
          type="button"
          onClick={() => onDelete(achievement.id)}
          aria-label={`Borrar ${achievement.regatta_name}`}
          className="focus-ring h-8 shrink-0 rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function AchievementTimeline({
  achievements,
  total,
  isOwner,
  onDelete,
}: {
  achievements: RegattaAchievement[];
  total: number;
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? achievements : achievements.slice(0, 5);

  return (
    <>
      <ol className="mt-3">
        {shown.map((a) => (
          <AchievementRow
            key={a.id}
            achievement={a}
            isOwner={isOwner}
            onDelete={onDelete}
          />
        ))}
      </ol>

      {achievements.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="focus-ring mt-1 rounded-lg text-sm font-semibold text-water-600 hover:underline"
        >
          {expanded
            ? 'Ver menos'
            : `Ver los ${achievements.length} logros`}
        </button>
      )}

      {total > achievements.length && (
        <p className="mt-2 text-xs text-navy-400">
          Mostrando {achievements.length} de {total} logros.
        </p>
      )}
    </>
  );
}
