'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme, saveTheme, type Theme } from '@/lib/theme';

/** Suscripción mínima para que el selector se entere de los cambios. */
const listeners = new Set<() => void>();

function subscribeToTheme(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function notifyThemeChange() {
  for (const listener of listeners) listener();
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

/**
 * Selector de tema (claro / oscuro / seguir al sistema).
 */
export function ThemeToggle() {
  // El tema vive fuera de React (localStorage), así que se lee como
  // store externo: en el servidor devuelve 'system' y en el cliente el
  // valor guardado, sin setState dentro de un efecto.
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readTheme,
    () => 'system' as Theme
  );

  // Con "Sistema" elegido, cambiar el modo del SO tiene que reflejarse
  // en el momento, sin recargar.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  function choose(next: Theme) {
    saveTheme(next);
    notifyThemeChange();
  }

  return (
    <div
      className="inline-flex gap-1 rounded-xl border border-navy-100 bg-navy-50 p-1"
      role="radiogroup"
      aria-label="Tema de la aplicación"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(value)}
            className={`focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-navy-500 hover:text-navy-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
