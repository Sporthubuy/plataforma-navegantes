import jwt from 'jsonwebtoken';
import { config } from '../config';

/**
 * Firma un JWT propio para el usuario indicado. Expira en 7 días.
 * El id del usuario se guarda en el claim estándar `sub`.
 */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}
