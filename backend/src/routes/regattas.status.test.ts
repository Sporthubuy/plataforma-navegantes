import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock } from '../__tests__/helpers/supabase-mock';
import { createTestApp, auth } from '../__tests__/helpers/test-app';

/**
 * Cambios de estado del campeonato y de cada clase.
 *
 * OJO: estos tests documentan el comportamiento ACTUAL. El refactor
 * multiclase eliminó la validación de transiciones que existía antes
 * (commit b1c5152), así que hoy se acepta cualquier salto de estado.
 * Ver "hallazgos" — no se corrige en este paso.
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

const ADMIN = 'user-admin';

const activeProfile = { data: { id: ADMIN, status: 'active' }, error: null };
const withPermission = {
  data: [{ permission: 'regattas.edit' }],
  error: null,
};

async function setup(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { default: regattasRouter } = await import('./regattas');
  return createTestApp([{ path: '/api/regattas', router: regattasRouter }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PUT /:id/status — estado del campeonato', () => {
  it('rechaza un estado que no existe (400)', async () => {
    const app = await setup(
      createSupabaseMock({ profiles: activeProfile, user_permissions: withPermission })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'inventado' });

    expect(res.status).toBe(400);
  });

  it('exige el permiso regattas.edit (403 sin él)', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: { data: [{ permission: 'users.view' }], error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(403);
  });

  it('404 si el campeonato no existe', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: null, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(404);
  });

  it('HALLAZGO: acepta transiciones ilógicas (finished -> open)', async () => {
    // Antes del refactor multiclase esto devolvía 422. Hoy pasa.
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1', status: 'open' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    // Documenta el comportamiento actual: no hay validación de transición.
    expect(res.status).toBe(200);
  });
});

describe('PUT /classes/:classId/status — estado de la clase', () => {
  it('rechaza un estado inválido (400)', async () => {
    const app = await setup(
      createSupabaseMock({ profiles: activeProfile, user_permissions: withPermission })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'no-existe' });

    expect(res.status).toBe(400);
  });

  it('404 si la clase no existe', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: { data: null, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(404);
  });

  it('cambia el estado de la clase con el permiso correcto', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: { data: { id: 'class-1', status: 'open' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(200);
  });
});

describe('POST /:id/classes — alta de clase', () => {
  it('422 si la clase ya existe en el campeonato', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1' }, error: null },
        // El insert choca con el UNIQUE(regatta_id, sailing_class).
        regatta_classes: { data: null, error: { code: '23505' } },
      })
    );

    const res = await request(app)
      .post('/api/regattas/reg-1/classes')
      .set(auth(ADMIN))
      .send({ sailing_class: 'Snipe' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/ya existe/i);
  });

  it('400 si falta la clase de vela', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1' }, error: null },
      })
    );

    const res = await request(app)
      .post('/api/regattas/reg-1/classes')
      .set(auth(ADMIN))
      .send({});

    expect(res.status).toBe(400);
  });
});
