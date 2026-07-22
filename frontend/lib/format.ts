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

/**
 * Tiempo relativo detallado en español: "hace 15 minutos", "hace 2
 * horas", "ayer", "hace 3 días". Más expresivo que `timeAgo`, que
 * abrevia ("hace 2 h") para espacios chicos.
 */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'recién';
  if (diffMin < 60) return `hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'ayer';
  if (diffDays < 30) return `hace ${diffDays} días`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;

  const diffYears = Math.floor(diffMonths / 12);
  return `hace ${diffYears} ${diffYears === 1 ? 'año' : 'años'}`;
}

/** ¿La fecha es de las últimas 24 horas? (badge "Nuevo"). */
export function isRecent(iso: string | null | undefined, hours = 24): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < hours * 3600_000;
}

/** Fecha corta para badges: "15 ago". */
export function formatShortDate(iso: string): string {
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(
    'es',
    { day: 'numeric', month: 'short' }
  );
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
