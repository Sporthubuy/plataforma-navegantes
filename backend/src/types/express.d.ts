import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
      /** Cache de permisos del usuario autenticado (por request). */
      permissions?: string[];
    }
  }
}

export {};
