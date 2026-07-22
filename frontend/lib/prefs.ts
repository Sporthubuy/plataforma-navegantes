'use client';

import { useCallback, useState } from 'react';

export interface Prefs {
  country: string;
  timezone: string;
  locale: string;
}

const KEY = 'navegantes_prefs';
const DEFAULT_COUNTRY = 'UY';

const COMMON_TIMEZONES = [
  'America/Montevideo',
  'America/Argentina/Buenos_Aires',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
];

const LOCALES = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'de', label: 'Deutsch' },
];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Montevideo';
  } catch {
    return 'America/Montevideo';
  }
}

function load(): Prefs {
  if (typeof window === 'undefined') {
    return { country: DEFAULT_COUNTRY, timezone: 'America/Montevideo', locale: 'es' };
  }
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        country: parsed.country ?? DEFAULT_COUNTRY,
        timezone: parsed.timezone ?? detectTimezone(),
        locale: parsed.locale ?? 'es',
      };
    }
  } catch {}
  return {
    country: DEFAULT_COUNTRY,
    timezone: detectTimezone(),
    locale: 'es',
  };
}

export function usePrefs() {
  // lazy init: lee de localStorage al montar (en el cliente).
  const [prefs, setPrefs] = useState<Prefs>(() =>
    typeof window === 'undefined'
      ? { country: DEFAULT_COUNTRY, timezone: 'America/Montevideo', locale: 'es' }
      : load()
  );

  const update = useCallback((changes: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...changes };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return { prefs, update };
}

/** Lista de zonas horarias para el select de ajustes. */
export { COMMON_TIMEZONES, LOCALES };