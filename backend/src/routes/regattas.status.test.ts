import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock } from '../__tests__/helpers/supabase-mock';
import { createTestApp, auth } from '../__tests__/helpers/test-app';

/**
 * Cambios de estado del campeonato y de cada clase.
 *
 * Ciclo de vida: upcoming → open → in_progress → finished, más
 * `cancelled` desde cualquier estado no terminal. `finished` y
 * `cancelled` son terminales. Quedarse en el mismo estado es no-op.
 *
 * La validación se aplica en los cuatro caminos que mutan el estado:
 * los dos endpoints /status y los dos PUT de edición que aceptan
 * `status` en el body.
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

  it('rechaza reabrir un campeonato terminado (finished -> open)', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1', status: 'finished' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no se puede pasar de "finished" a "open"/i);
  });

  it('rechaza saltarse pasos del ciclo (upcoming -> finished)', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1', status: 'upcoming' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'finished' });

    expect(res.status).toBe(422);
  });

  it('rechaza revivir un campeonato cancelado', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1', status: 'cancelled' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(422);
  });

  it('acepta el avance normal del ciclo', async () => {
    const pasos: Array<[string, string]> = [
      ['upcoming', 'open'],
      ['open', 'in_progress'],
      ['in_progress', 'finished'],
    ];

    for (const [desde, hacia] of pasos) {
      const app = await setup(
        createSupabaseMock({
          profiles: activeProfile,
          user_permissions: withPermission,
          regattas: [
            { data: { id: 'reg-1', status: desde }, error: null }, // lectura
            { data: { id: 'reg-1', status: hacia }, error: null }, // update
          ],
        })
      );

      const res = await request(app)
        .put('/api/regattas/reg-1/status')
        .set(auth(ADMIN))
        .send({ status: hacia });

      expect(res.status, `${desde} -> ${hacia}`).toBe(200);
    }
  });

  it('permite cancelar desde cualquier estado no terminal', async () => {
    for (const desde of ['upcoming', 'open', 'in_progress']) {
      const app = await setup(
        createSupabaseMock({
          profiles: activeProfile,
          user_permissions: withPermission,
          regattas: [
            { data: { id: 'reg-1', status: desde }, error: null },
            { data: { id: 'reg-1', status: 'cancelled' }, error: null },
          ],
        })
      );

      const res = await request(app)
        .put('/api/regattas/reg-1/status')
        .set(auth(ADMIN))
        .send({ status: 'cancelled' });

      expect(res.status, `${desde} -> cancelled`).toBe(200);
    }
  });

  it('quedarse en el mismo estado es un no-op válido', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: [
          { data: { id: 'reg-1', status: 'finished' }, error: null },
          { data: { id: 'reg-1', status: 'finished' }, error: null },
        ],
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1/status')
      .set(auth(ADMIN))
      .send({ status: 'finished' });

    expect(res.status).toBe(200);
  });
});

describe('PUT /:id — el body.status no puede saltarse el ciclo', () => {
  it('rechaza una transición inválida enviada por el PUT de edición', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: { data: { id: 'reg-1', status: 'finished' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no se puede pasar/i);
  });

  it('deja editar otros campos sin tocar el estado', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regattas: [
          { data: { id: 'reg-1', status: 'finished' }, error: null },
          { data: { id: 'reg-1', name: 'Nuevo nombre' }, error: null },
        ],
      })
    );

    const res = await request(app)
      .put('/api/regattas/reg-1')
      .set(auth(ADMIN))
      .send({ name: 'Nuevo nombre' });

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

  it('abre las inscripciones de la clase (upcoming -> open)', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: [
          { data: { id: 'class-1', status: 'upcoming' }, error: null },
          { data: { id: 'class-1', status: 'open' }, error: null },
        ],
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(200);
  });

  it('rechaza reabrir una clase ya terminada (finished -> open)', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: { data: { id: 'class-1', status: 'finished' }, error: null },
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no se puede pasar de "finished" a "open"/i);
  });

  it('cada clase avanza con su propio ciclo, independiente del campeonato', async () => {
    // Una clase puede terminar mientras otra sigue en curso: la
    // validación es por clase, no global.
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: [
          { data: { id: 'class-1', status: 'in_progress' }, error: null },
          { data: { id: 'class-1', status: 'finished' }, error: null },
        ],
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1/status')
      .set(auth(ADMIN))
      .send({ status: 'finished' });

    expect(res.status).toBe(200);
  });

  it('el PUT de edición de la clase tampoco puede saltarse el ciclo', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: {
          data: { id: 'class-1', sailing_class: 'Snipe', status: 'finished' },
          error: null,
        },
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1')
      .set(auth(ADMIN))
      .send({ status: 'open' });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no se puede pasar/i);
  });

  it('deja editar descartes de una clase terminada sin tocar el estado', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile,
        user_permissions: withPermission,
        regatta_classes: [
          { data: { id: 'class-1', sailing_class: 'Snipe', status: 'finished' }, error: null },
          { data: { id: 'class-1', discards_count: 2 }, error: null },
        ],
      })
    );

    const res = await request(app)
      .put('/api/regattas/classes/class-1')
      .set(auth(ADMIN))
      .send({ discards_count: 2 });

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
