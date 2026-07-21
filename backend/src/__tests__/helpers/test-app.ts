import express, { type Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Monta una app Express mínima para tests, con el mismo middleware de
 * JSON y el mismo error handler que producción. No se importa
 * `src/index.ts` a propósito: ese módulo hace `listen()` al importarse.
 */
export function createTestApp(mounts: Array<{ path: string; router: Router }>) {
  const app = express();
  app.use(express.json());
  for (const { path, router } of mounts) {
    app.use(path, router);
  }
  app.use((_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'Error interno del servidor', detail: String(err) });
  });
  return app;
}

/** Token válido para el usuario indicado (firmado con el secreto de test). */
export function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

export const auth = (userId: string) => ({
  Authorization: `Bearer ${tokenFor(userId)}`,
});
