import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { supabaseAdmin } from '../lib/supabase';

interface JwtPayload {
  sub: string;
}

const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;
// Cache en memoria del último last_active_at conocido por usuario,
// para no golpear la base en cada request.
const lastActivityUpdate = new Map<string, number>();

/** Actualiza last_active_at de forma no bloqueante y con throttle. */
function trackActivity(userId: string): void {
  const now = Date.now();
  const previous = lastActivityUpdate.get(userId);
  if (previous && now - previous < ACTIVITY_THROTTLE_MS) return;

  lastActivityUpdate.set(userId, now);
  void supabaseAdmin
    .from('profiles')
    .update({ last_active_at: new Date(now).toISOString() })
    .eq('id', userId)
    .then(({ error }) => {
      if (error) {
        // Si falló, permite reintentar en el próximo request.
        lastActivityUpdate.delete(userId);
      }
    });
}

/**
 * Valida el header Authorization con formato "Bearer <token>",
 * verifica el JWT firmado con JWT_SECRET y adjunta req.user = { id }.
 * Bloquea cuentas suspendidas y registra actividad.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta el token de autenticación' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();

  let userId: string;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    if (!payload.sub) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
    return;
  }

  // Verifica que la cuenta exista y no esté suspendida.
  supabaseAdmin
    .from('profiles')
    .select('id, status')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) {
        next(error);
        return;
      }
      if (!data) {
        res.status(401).json({ error: 'Cuenta no encontrada' });
        return;
      }
      if (data.status === 'suspended') {
        res.status(403).json({ error: 'Cuenta suspendida' });
        return;
      }

      req.user = { id: userId };
      trackActivity(userId);
      next();
    });
}
