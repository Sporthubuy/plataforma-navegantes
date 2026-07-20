/** Fecha corta legible en español, o "—" si no hay valor. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Fecha + hora legible. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Distancia relativa aproximada ("hace 3 h"), o "nunca". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return formatDate(iso);
}

/** Rango de fechas: "1–3 ago 2026" o "30 jul – 2 ago 2026". */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso + 'T00:00:00');
  const end = new Date(endIso + 'T00:00:00');
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (sameMonth) {
    if (start.getDate() === end.getDate()) {
      return start.toLocaleDateString('es', { ...opts, year: 'numeric' });
    }
    return `${start.getDate()}–${end.toLocaleDateString('es', { ...opts, year: 'numeric' })}`;
  }
  return `${start.toLocaleDateString('es', opts)} – ${end.toLocaleDateString('es', { ...opts, year: 'numeric' })}`;
}

export const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  sailor: 'Navegante',
  club: 'Club',
  federation: 'Federación',
};
