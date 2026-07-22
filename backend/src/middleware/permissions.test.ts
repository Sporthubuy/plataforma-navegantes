import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createSupabaseMock } from '../__tests__/helpers/supabase-mock';
import { createTestApp, auth, tokenFor } from '../__tests__/helpers/test-app';

/**
 * Middleware de autenticación y permisos granulares.
 * El cliente de Supabase está mockeado: se verifica la lógica de
 * autorización, no la base.
 */

const holder = vi.hoisted(() => ({ current: null as ReturnType<typeof createSupabaseMock> | null }));
vi.mock('../lib/supabase', () => ({
  get supabaseAdmin() {
    return holder.current;
  },
  get supabaseAnon() {
    return holder.current;
  },
}));

const USER = 'user-1';

const activeProfile = { data: { id: USER, status: 'active' }, error: null };
const suspendedProfile = { data: { id: USER, status: 'suspended' }, error: null };
const permissions = (perms: string[]) => ({
  data: perms.map((p) => ({ permission: p })),
  error: null,
});

/** App con dos rutas: una solo autenticada y otra que exige permiso. */
async function setup(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { requireAuth } = await import('./auth');
  const { requirePermission } = await import('./permissions');

  const router = Router();
  router.get('/solo-auth', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });
  router.get('/necesita-permiso', requireAuth, requirePermission('users.view'), (_req, res) => {
    res.json({ ok: true });
  });
  return createTestApp([{ path: '/t', router }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  it('sin token rechaza con 401 (falta credencial)', async () => {
    // NOTA: la especificación original decía 403 para "sin token".
    // La implementación devuelve 401, que es lo correcto según HTTP
    // (401 = no autenticado, 403 = autenticado pero sin permiso).
    // Se testea el comportamiento real; ver lista de hallazgos.
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));

    const res = await request(app).get('/t/solo-auth');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/falta el token/i);
  });

  it('con token inválido rechaza con 401', async () => {
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));

    const res = await request(app)
      .get('/t/solo-auth')
      .set('Authorization', 'Bearer token-basura');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/inválido|expirado/i);
  });

  it('con token firmado por otro secreto rechaza con 401', async () => {
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));
    const ajeno = jwt.sign({ sub: USER }, 'otro-secreto-distinto');

    const res = await request(app).get('/t/solo-auth').set('Authorization', `Bearer ${ajeno}`);

    expect(res.status).toBe(401);
  });

  it('con token expirado rechaza con 401', async () => {
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));
    const vencido = jwt.sign({ sub: USER }, process.env.JWT_SECRET!, { expiresIn: '-1s' });

    const res = await request(app).get('/t/solo-auth').set('Authorization', `Bearer ${vencido}`);

    expect(res.status).toBe(401);
  });

  it('sin el prefijo "Bearer" rechaza con 401', async () => {
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));

    const res = await request(app).get('/t/solo-auth').set('Authorization', tokenFor(USER));

    expect(res.status).toBe(401);
  });

  it('con token válido y cuenta activa deja pasar', async () => {
    const app = await setup(createSupabaseMock({ profiles: activeProfile }));

    const res = await request(app).get('/t/solo-auth').set(auth(USER));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('bloquea a un usuario suspendido con 403', async () => {
    const app = await setup(createSupabaseMock({ profiles: suspendedProfile }));

    const res = await request(app).get('/t/solo-auth').set(auth(USER));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cuenta suspendida/i);
  });

  it('rechaza con 401 si el perfil ya no existe', async () => {
    const app = await setup(createSupabaseMock({ profiles: { data: null, error: null } }));

    const res = await request(app).get('/t/solo-auth').set(auth(USER));

    expect(res.status).toBe(401);
  });
});

describe('requirePermission', () => {
  it('403 si el usuario no tiene el permiso requerido', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: permissions(['boats.view_all']), // otro permiso
      })
    );

    const res = await request(app).get('/t/necesita-permiso').set(auth(USER));

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('users.view');
  });

  it('403 si el usuario no tiene ningún permiso', async () => {
    const app = await setup(
      createSupabaseMock({ profiles: activeProfile, user_permissions: permissions([]) })
    );

    const res = await request(app).get('/t/necesita-permiso').set(auth(USER));

    expect(res.status).toBe(403);
  });

  it('deja pasar si el usuario tiene el permiso exacto', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: permissions(['users.view']),
      })
    );

    const res = await request(app).get('/t/necesita-permiso').set(auth(USER));

    expect(res.status).toBe(200);
  });

  it('deja pasar si tiene el permiso entre varios', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: permissions(['boats.edit_all', 'users.view', 'users.delete']),
      })
    );

    const res = await request(app).get('/t/necesita-permiso').set(auth(USER));

    expect(res.status).toBe(200);
  });

  it('un usuario suspendido no llega al chequeo de permisos', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: suspendedProfile,
        user_permissions: permissions(['users.view']), // tendría el permiso
      })
    );

    const res = await request(app).get('/t/necesita-permiso').set(auth(USER));

    // Gana la suspensión: 403 por cuenta suspendida, no por permiso.
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cuenta suspendida/i);
  });

  it('sin autenticar no evalúa permisos', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: permissions(['users.view']),
      })
    );

    const res = await request(app).get('/t/necesita-permiso');

    expect(res.status).toBe(401);
  });
});

describe('catálogo de permisos', () => {
  it('expone los permisos del sistema con descripción', async () => {
    holder.current = createSupabaseMock({});
    vi.resetModules();
    const { ALL_PERMISSIONS, PERMISSION_CATALOG } = await import('./permissions');

    // Los 13 permisos vigentes (usuarios, barcos, regatas y clubes).
    expect(ALL_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'users.view',
        'users.suspend',
        'users.delete',
        'users.grant_permissions',
        'users.verify',
        'boats.view_all',
        'boats.edit_all',
        'boats.create_all',
        'regattas.create',
        'regattas.edit',
        'regattas.delete',
        'regattas.manage_results',
        'clubs.manage',
      ])
    );
    // Todos tienen descripción legible.
    for (const p of ALL_PERMISSIONS) {
      expect(PERMISSION_CATALOG[p]).toBeTruthy();
    }
  });
});
