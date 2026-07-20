/**
 * Sanitización de los campos ampliados del perfil (datos náuticos y
 * redes). Devuelve el conjunto de updates listo para persistir o un
 * error de validación con status HTTP.
 */

const MAX_TEXT = 100;
const MAX_URL = 300;

export interface SanitizeError {
  status: number;
  message: string;
}

export type SanitizeResult =
  | { updates: Record<string, unknown> }
  | { error: SanitizeError };

/** Texto libre: trim, tope de longitud, vacío → null. */
function cleanText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/**
 * Normaliza un handle de Instagram: quita el @, quita la URL si pegaron
 * "instagram.com/xxx" y se queda solo con el handle.
 */
export function normalizeInstagram(value: string): string {
  let v = value.trim();
  v = v.replace(/^https?:\/\//i, '');
  v = v.replace(/^(www\.)?instagram\.com\//i, '');
  v = v.replace(/^@/, '');
  // Primer segmento del path, sin query ni fragment.
  v = v.split(/[/?#]/)[0];
  return v;
}

const INSTAGRAM_HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** ¿Es una URL http(s) bien formada? */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** ¿Parece una URL (trae protocolo http)? */
function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Construye los updates de los campos ampliados. Los que no vienen en
 * el body se ignoran; los que vienen vacíos se guardan como null.
 */
export function sanitizeProfileExtras(
  body: Record<string, unknown>
): SanitizeResult {
  const updates: Record<string, unknown> = {};

  // Datos náuticos — texto libre.
  for (const field of ['club', 'sailing_class', 'usual_role', 'location']) {
    if (body[field] !== undefined) {
      updates[field] = cleanText(body[field]);
    }
  }

  // Instagram — solo el handle.
  if (body.instagram !== undefined) {
    const raw = typeof body.instagram === 'string' ? body.instagram.trim() : '';
    if (!raw) {
      updates.instagram = null;
    } else {
      const handle = normalizeInstagram(raw);
      if (!INSTAGRAM_HANDLE.test(handle)) {
        return {
          error: {
            status: 422,
            message:
              'Instagram inválido: usá tu handle (letras, números, punto o guion bajo)',
          },
        };
      }
      updates.instagram = handle;
    }
  }

  // Facebook / YouTube — URL o handle. Si es URL, validación suave de dominio.
  const socialDomains: Record<string, { hosts: string[]; label: string }> = {
    facebook: { hosts: ['facebook.com', 'fb.com', 'fb.me'], label: 'Facebook' },
    youtube: { hosts: ['youtube.com', 'youtu.be'], label: 'YouTube' },
  };
  for (const [field, { hosts, label }] of Object.entries(socialDomains)) {
    if (body[field] === undefined) continue;
    const raw = typeof body[field] === 'string' ? (body[field] as string).trim() : '';
    if (!raw) {
      updates[field] = null;
      continue;
    }
    if (looksLikeUrl(raw)) {
      if (!isHttpUrl(raw)) {
        return {
          error: { status: 422, message: `La URL de ${label} no es válida` },
        };
      }
      const host = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase();
      const ok = hosts.some((h) => host === h || host.endsWith(`.${h}`));
      if (!ok) {
        return {
          error: {
            status: 422,
            message: `Esa URL no parece de ${label}`,
          },
        };
      }
    }
    // Handle o URL válida: se guarda tal cual (con tope de longitud).
    updates[field] = raw.slice(0, MAX_URL);
  }

  // Website — URL http(s) obligatoria.
  if (body.website !== undefined) {
    const raw = typeof body.website === 'string' ? body.website.trim() : '';
    if (!raw) {
      updates.website = null;
    } else if (!isHttpUrl(raw)) {
      return {
        error: {
          status: 422,
          message:
            'El sitio web debe ser una URL válida que empiece con http:// o https://',
        },
      };
    } else {
      updates.website = raw.slice(0, MAX_URL);
    }
  }

  return { updates };
}
