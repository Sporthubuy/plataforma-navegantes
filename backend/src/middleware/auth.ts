import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

interface JwtPayload {
  sub: string;
}

/**
 * Valida el header Authorization con formato "Bearer <token>",
 * verifica el JWT firmado con JWT_SECRET y adjunta req.user = { id }.
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

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    if (!payload.sub) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    req.user = { id: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
