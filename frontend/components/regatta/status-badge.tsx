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

/**
 * Ciclo de vida del estado (espejo de la validación del backend):
 *   upcoming → open → in_progress → finished
 * más `cancelled` desde cualquier estado no terminal.
 * `finished` y `cancelled` son terminales.
 */
const STATUS_TRANSITIONS: Record<RegattaStatus, RegattaStatus[]> = {
  upcoming: ['open', 'cancelled'],
  open: ['in_progress', 'cancelled'],
  in_progress: ['finished', 'cancelled'],
  finished: [],
  cancelled: [],
};

/**
 * Estados que se pueden elegir desde `current`: el actual (no-op) más
 * los alcanzables. Se usa para que los selectores no ofrezcan opciones
 * que el backend va a rechazar con 422.
 */
export function allowedRegattaStatuses(current: RegattaStatus): RegattaStatus[] {
  return [current, ...STATUS_TRANSITIONS[current]];
}

/** ¿Es un estado terminal (ya no admite cambios)? */
export function isTerminalStatus(status: RegattaStatus): boolean {
  return STATUS_TRANSITIONS[status].length === 0;
}

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
