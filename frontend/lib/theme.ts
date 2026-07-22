export type Theme = 'light' | 'dark' | 'system';

export const THEME_KEY = 'navegantes_theme';

/**
 * Script que corre antes de pintar. Sin esto la página arranca en claro
 * y salta a oscuro al hidratar, que es el clásico destello blanco.
 * Va inline en el <head>, así que se escribe compacto y sin depender
 * de nada del bundle.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem('${THEME_KEY}')||'system';
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(d)document.documentElement.setAttribute('data-theme','dark');
}catch(e){}})();`;

/** Aplica el tema al documento. `system` sigue la preferencia del SO. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function readTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system'
    ? stored
    : 'system';
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}
