import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock } from '../__tests__/helpers/supabase-mock';
import { createTestApp, auth } from '../__tests__/helpers/test-app';

/**
 * Un usuario no puede tocar recursos de otro: perfil, barco,
 * tripulación e inscripción ajenos.
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

const DUENIO = 'user-duenio';
const INTRUSO = 'user-intruso';
const BOAT_ID = 'boat-1';

const activeProfile = (id: string) => ({ data: { id, status: 'active' }, error: null });

async function setupBoats(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { default: boatsRouter } = await import('./boats');
  return createTestApp([{ path: '/api/boats', router: boatsRouter }]);
}

async function setupUsers(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { default: usersRouter } = await import('./users');
  return createTestApp([{ path: '/api/users', router: usersRouter }]);
}

async function setupCrew(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { default: crewRouter } = await import('./crew');
  return createTestApp([{ path: '/api/crew', router: crewRouter }]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('perfil ajeno', () => {
  it('no se puede editar el perfil de otro usuario (403)', async () => {
    const app = await setupUsers(createSupabaseMock({ profiles: activeProfile(INTRUSO) }));

    const res = await request(app)
      .put(`/api/users/profile/${DUENIO}`)
      .set(auth(INTRUSO))
      .send({ name: 'Hackeado' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tu propio perfil/i);
  });

  it('no se puede eliminar la cuenta de otro usuario (403)', async () => {
    const app = await setupUsers(createSupabaseMock({ profiles: activeProfile(INTRUSO) }));

    const res = await request(app)
      .delete(`/api/users/profile/${DUENIO}`)
      .set(auth(INTRUSO));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/tu propia cuenta/i);
  });

  it('el dueño sí puede editar su propio perfil', async () => {
    const app = await setupUsers(
      createSupabaseMock({
        profiles: [
          activeProfile(DUENIO), // requireAuth
          { data: { id: DUENIO, username: 'duenio', name: 'Nuevo' }, error: null }, // update
        ],
      })
    );

    const res = await request(app)
      .put(`/api/users/profile/${DUENIO}`)
      .set(auth(DUENIO))
      .send({ name: 'Nuevo' });

    expect(res.status).toBe(200);
  });
});

describe('barco ajeno', () => {
  const barcoDeOtro = { data: { id: BOAT_ID, owner_id: DUENIO }, error: null };

  it('no se puede editar el barco de otro (403)', async () => {
    const app = await setupBoats(
      createSupabaseMock({ profiles: activeProfile(INTRUSO), boats: barcoDeOtro })
    );

    const res = await request(app)
      .put(`/api/boats/${BOAT_ID}`)
      .set(auth(INTRUSO))
      .send({ name: 'Robado' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dueño/i);
  });

  it('no se puede borrar el barco de otro (403)', async () => {
    const app = await setupBoats(
      createSupabaseMock({ profiles: activeProfile(INTRUSO), boats: barcoDeOtro })
    );

    const res = await request(app).delete(`/api/boats/${BOAT_ID}`).set(auth(INTRUSO));

    expect(res.status).toBe(403);
  });

  it('no se puede subir foto al barco de otro (403)', async () => {
    const app = await setupBoats(
      createSupabaseMock({ profiles: activeProfile(INTRUSO), boats: barcoDeOtro })
    );

    const res = await request(app)
      .post(`/api/boats/${BOAT_ID}/photo`)
      .set(auth(INTRUSO))
      .attach('file', Buffer.from('fake'), { filename: 'x.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
  });

  it('404 si el barco no existe (antes de evaluar propiedad)', async () => {
    const app = await setupBoats(
      createSupabaseMock({ profiles: activeProfile(INTRUSO), boats: { data: null, error: null } })
    );

    const res = await request(app).put(`/api/boats/${BOAT_ID}`).set(auth(INTRUSO)).send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('el dueño sí puede editar su barco', async () => {
    const app = await setupBoats(
      createSupabaseMock({
        profiles: activeProfile(DUENIO),
        boats: [
          barcoDeOtro, // findOwnedBoat: owner_id === DUENIO
          { data: { id: BOAT_ID, name: 'Nuevo nombre' }, error: null }, // update
        ],
      })
    );

    const res = await request(app)
      .put(`/api/boats/${BOAT_ID}`)
      .set(auth(DUENIO))
      .send({ name: 'Nuevo nombre' });

    expect(res.status).toBe(200);
  });
});

describe('tripulación ajena', () => {
  it('un tercero no puede quitar a un tripulante (403)', async () => {
    // El crew_member pertenece a DUENIO (barco) y a otro usuario.
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(INTRUSO),
        crew_members: {
          data: { id: 'crew-1', user_id: 'user-tripulante', boat: { owner_id: DUENIO } },
          error: null,
        },
      })
    );

    const res = await request(app).delete('/api/crew/crew-1').set(auth(INTRUSO));

    expect(res.status).toBe(403);
  });

  it('el dueño del barco sí puede quitar a un tripulante', async () => {
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(DUENIO),
        crew_members: {
          data: { id: 'crew-1', user_id: 'user-tripulante', boat: { owner_id: DUENIO } },
          error: null,
        },
      })
    );

    const res = await request(app).delete('/api/crew/crew-1').set(auth(DUENIO));

    expect(res.status).toBe(204);
  });

  it('el propio tripulante puede salirse del barco', async () => {
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(INTRUSO),
        crew_members: {
          data: { id: 'crew-1', user_id: INTRUSO, boat: { owner_id: DUENIO } },
          error: null,
        },
      })
    );

    const res = await request(app).delete('/api/crew/crew-1').set(auth(INTRUSO));

    expect(res.status).toBe(204);
  });

  it('no se puede aceptar una invitación ajena (403)', async () => {
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(INTRUSO),
        crew_members: {
          data: { id: 'inv-1', user_id: 'otro-invitado', status: 'pending' },
          error: null,
        },
      })
    );

    const res = await request(app).put('/api/crew/invitations/inv-1/accept').set(auth(INTRUSO));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invitado/i);
  });

  it('el invitado sí puede aceptar su invitación', async () => {
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(INTRUSO),
        crew_members: [
          { data: { id: 'inv-1', user_id: INTRUSO, status: 'pending' }, error: null }, // lookup
          { data: { id: 'inv-1', status: 'accepted' }, error: null }, // update
        ],
      })
    );

    const res = await request(app).put('/api/crew/invitations/inv-1/accept').set(auth(INTRUSO));

    expect(res.status).toBe(200);
  });

  it('no se puede invitar tripulantes a un barco ajeno (403)', async () => {
    const app = await setupCrew(
      createSupabaseMock({
        profiles: activeProfile(INTRUSO),
        boats: { data: { id: BOAT_ID, owner_id: DUENIO }, error: null },
      })
    );

    const res = await request(app)
      .post('/api/crew/invite')
      .set(auth(INTRUSO))
      .send({ boat_id: BOAT_ID, username: 'alguien', role: 'Proa' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dueño del barco/i);
  });
});

describe('inscripción ajena', () => {
  it('no se puede retirar una inscripción que no es propia (404)', async () => {
    holder.current = createSupabaseMock({
      profiles: activeProfile(INTRUSO),
      // La única inscripción confirmada es de otro usuario.
      regatta_entries: {
        data: [{ id: 'entry-1', registered_by: DUENIO, boat: { owner_id: DUENIO } }],
        error: null,
      },
    });
    vi.resetModules();
    const { default: regattasRouter } = await import('./regattas');
    const app = createTestApp([{ path: '/api/regattas', router: regattasRouter }]);

    const res = await request(app)
      .delete('/api/regattas/classes/class-1/register')
      .set(auth(INTRUSO));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no tienes una inscripción/i);
  });

  it('con 2 barcos propios y sin boat_id pide elegir (422) en vez de adivinar', async () => {
    holder.current = createSupabaseMock({
      profiles: activeProfile(DUENIO),
      regatta_entries: {
        data: [
          {
            id: 'entry-A',
            boat_id: 'boat-A',
            registered_by: DUENIO,
            boat: { id: 'boat-A', name: 'Gaviota', owner_id: DUENIO },
          },
          {
            id: 'entry-B',
            boat_id: 'boat-B',
            registered_by: DUENIO,
            boat: { id: 'boat-B', name: 'Ráfaga', owner_id: DUENIO },
          },
        ],
        error: null,
      },
    });
    vi.resetModules();
    const { default: regattasRouter } = await import('./regattas');
    const app = createTestApp([{ path: '/api/regattas', router: regattasRouter }]);

    const res = await request(app)
      .delete('/api/regattas/classes/class-1/register')
      .set(auth(DUENIO));

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/indicá cuál retirar/i);
    // Devuelve los candidatos para que el cliente pueda elegir.
    expect(res.body.boats).toEqual([
      { boat_id: 'boat-A', name: 'Gaviota' },
      { boat_id: 'boat-B', name: 'Ráfaga' },
    ]);
  });

  it('con boat_id retira exactamente ese barco', async () => {
    const mock = createSupabaseMock({
      profiles: activeProfile(DUENIO),
      regatta_entries: {
        data: [
          {
            id: 'entry-A',
            boat_id: 'boat-A',
            registered_by: DUENIO,
            boat: { id: 'boat-A', name: 'Gaviota', owner_id: DUENIO },
          },
          {
            id: 'entry-B',
            boat_id: 'boat-B',
            registered_by: DUENIO,
            boat: { id: 'boat-B', name: 'Ráfaga', owner_id: DUENIO },
          },
        ],
        error: null,
      },
    });
    holder.current = mock;
    vi.resetModules();
    const { default: regattasRouter } = await import('./regattas');
    const app = createTestApp([{ path: '/api/regattas', router: regattasRouter }]);

    const res = await request(app)
      .delete('/api/regattas/classes/class-1/register?boat_id=boat-B')
      .set(auth(DUENIO));

    expect(res.status).toBe(204);

    // El update apuntó a la entry del barco B, no a la primera de la lista.
    // Se correlaciona por tabla: `calls[i]` es la tabla de `results[i]`
    // (requireAuth también hace un update sobre `profiles`).
    const entriesUpdate = mock.from.mock.results
      .map((r, i) => ({ tabla: mock.calls[i], chain: r.value as Record<string, unknown> }))
      .find(
        ({ tabla, chain }) =>
          tabla === 'regatta_entries' &&
          (chain.update as { mock: { calls: unknown[][] } }).mock.calls.length > 0
      );

    expect(entriesUpdate).toBeDefined();
    const eqCalls = (entriesUpdate!.chain.eq as { mock: { calls: unknown[][] } }).mock.calls;
    expect(eqCalls.some((c) => c[1] === 'entry-B')).toBe(true);
  });

  it('404 si el boat_id indicado no es una inscripción propia', async () => {
    holder.current = createSupabaseMock({
      profiles: activeProfile(DUENIO),
      regatta_entries: {
        data: [
          {
            id: 'entry-A',
            boat_id: 'boat-A',
            registered_by: DUENIO,
            boat: { id: 'boat-A', name: 'Gaviota', owner_id: DUENIO },
          },
        ],
        error: null,
      },
    });
    vi.resetModules();
    const { default: regattasRouter } = await import('./regattas');
    const app = createTestApp([{ path: '/api/regattas', router: regattasRouter }]);

    const res = await request(app)
      .delete('/api/regattas/classes/class-1/register?boat_id=boat-ajeno')
      .set(auth(DUENIO));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/ese barco/i);
  });

  it('el dueño del barco sí puede retirar su inscripción', async () => {
    holder.current = createSupabaseMock({
      profiles: activeProfile(DUENIO),
      regatta_entries: {
        data: [{ id: 'entry-1', registered_by: DUENIO, boat: { owner_id: DUENIO } }],
        error: null,
      },
    });
    vi.resetModules();
    const { default: regattasRouter } = await import('./regattas');
    const app = createTestApp([{ path: '/api/regattas', router: regattasRouter }]);

    const res = await request(app)
      .delete('/api/regattas/classes/class-1/register')
      .set(auth(DUENIO));

    expect(res.status).toBe(204);
  });
});
