import type { RegattaStatus } from '@/lib/types';

export const REGATTA_STATUS: Record<
  RegattaStatus,
  { label: string; classes: string; dot: string }
> = {
  upcoming: {
    label: 'Próxima',
    classes: 'bg-navy-100 text-navy-700',
    dot: 'bg-navy-400',
  },
  open: {
    label: 'Inscripciones abiertas',
    classes: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
  },
  in_progress: {
    label: 'En curso',
    classes: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
  },
  finished: {
    label: 'Finalizada',
    classes: 'bg-navy-200 text-navy-800',
    dot: 'bg-navy-500',
  },
  cancelled: {
    label: 'Cancelada',
    classes: 'bg-red-100 text-red-700',
    dot: 'bg-red-500',
  },
};

export function RegattaStatusBadge({ status }: { status: RegattaStatus }) {
  const s = REGATTA_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
