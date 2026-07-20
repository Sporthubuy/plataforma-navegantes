import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

/**
 * Cliente admin: usa la service role key. Ignora las políticas de RLS.
 * Úsalo SOLO en el backend, nunca lo expongas al cliente.
 */
export const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Cliente anon: usa la anon key. Respeta las políticas de RLS.
 * Útil para operaciones de auth (login, registro, recuperar contraseña).
 */
export const supabaseAnon = createClient(
  config.supabaseUrl,
  config.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
