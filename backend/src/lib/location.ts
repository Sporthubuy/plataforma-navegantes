/**
 * Ubicaciones estructuradas: país (ISO 3166-1 alfa-2), ciudad y club.
 * Lo comparten perfiles, barcos, regatas y clasificados para que todos
 * validen igual.
 */

import { supabaseAdmin } from './supabase';

const MAX_CITY = 100;

export interface LocationError {
  status: number;
  message: string;
}

// Se discrimina por presencia de la clave (`'error' in result`): con
// `error?: undefined` TypeScript no estrecha, porque `string` no es un
// tipo unitario y no sirve como discriminante.
export type LocationResult =
  | { updates: Record<string, unknown> }
  | { error: LocationError };

interface Options {
  /** Aceptar `club_id`. */
  withClub?: boolean;
  /**
   * Aceptar `country`/`city`. Los barcos, por ejemplo, se ubican solo
   * por su club y no tienen esas columnas.
   */
  withCountryCity?: boolean;
}

/**
 * Valida país/ciudad (y club si corresponde) del body. Solo toca las
 * claves presentes: mandar null o '' limpia el campo.
 *
 * Es async porque comprueba que el club exista de verdad: un club_id
 * inventado tiene que dar 422, no un 500 por violación de FK.
 */
export async function sanitizeLocation(
  body: Record<string, unknown>,
  { withClub = false, withCountryCity = true }: Options = {}
): Promise<LocationResult> {
  const updates: Record<string, unknown> = {};

  if (withCountryCity && body.country !== undefined) {
    const raw = typeof body.country === 'string' ? body.country.trim() : '';
    if (!raw) {
      updates.country = null;
    } else {
      const country = raw.toUpperCase();
      if (!/^[A-Z]{2}$/.test(country)) {
        return {
          error: {
            status: 422,
            message: 'El país debe ser un código de 2 letras (ej: UY)',
          },
        };
      }
      updates.country = country;
    }
  }

  if (withCountryCity && body.city !== undefined) {
    const raw = typeof body.city === 'string' ? body.city.trim() : '';
    updates.city = raw ? raw.slice(0, MAX_CITY) : null;
  }

  // Una ciudad sin país no se puede ubicar en ningún mapa.
  if (updates.city && updates.country === null) {
    return {
      error: { status: 422, message: 'Elegí el país antes que la ciudad' },
    };
  }

  if (withClub && body.club_id !== undefined) {
    const raw = typeof body.club_id === 'string' ? body.club_id.trim() : '';
    if (!raw) {
      updates.club_id = null;
    } else {
      const { data, error } = await supabaseAdmin
        .from('clubs')
        .select('id')
        .eq('id', raw)
        .maybeSingle();

      // Un uuid mal formado hace fallar el cast en Postgres: se trata
      // igual que un club inexistente.
      if (error && error.code !== '22P02') throw error;
      if (!data) {
        return { error: { status: 422, message: 'El club elegido no existe' } };
      }
      updates.club_id = data.id;
    }
  }

  return { updates };
}
