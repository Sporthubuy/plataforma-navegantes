import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createSupabaseMock } from '../__tests__/helpers/supabase-mock';
import { createTestApp, auth } from '../__tests__/helpers/test-app';

/**
 * Reglas de negocio de POST /api/regattas/classes/:classId/register.
 *
 * Se mockea el cliente de Supabase: lo que se verifica es NUESTRA lógica
 * (orden de validaciones y códigos HTTP), no que Supabase funcione.
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

const OWNER = 'user-owner';
const OTHER = 'user-other';
const CLASS_ID = 'class-snipe';
const BOAT_ID = 'boat-gaviota';

/** Perfil activo para que `requireAuth` deje pasar. */
const activeProfile = (id: string) => ({ data: { id, status: 'active' }, error: null });

const snipeClass = (over: Record<string, unknown> = {}) => ({
  data: {
    id: CLASS_ID,
    regatta_id: 'regatta-1',
    sailing_class: 'Snipe',
    status: 'open',
    max_entries: null,
    ...over,
  },
  error: null,
});

/** Campeonato sin ventana de inscripción restrictiva. */
const openRegatta = {
  data: { registration_opens_at: null, registration_closes_at: null },
  error: null,
};

const snipeBoat = (over: Record<string, unknown> = {}) => ({
  data: {
    id: BOAT_ID,
    category: 'Snipe',
    sail_number: 'URU 77',
    owner_id: OWNER,
    ...over,
  },
  error: null,
});

/** Arma la app con el router real y el mock configurado. */
async function setup(mock: ReturnType<typeof createSupabaseMock>) {
  holder.current = mock;
  vi.resetModules();
  const { default: regattasRouter } = await import('./regattas');
  return createTestApp([{ path: '/api/regattas', router: regattasRouter }]);
}

const registerUrl = `/api/regattas/classes/${CLASS_ID}/register`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /classes/:classId/register — caso feliz', () => {
  it('inscribe el barco y devuelve 201 con la entry', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass(),
        regattas: openRegatta,
        boats: snipeBoat(),
        // Sin cupo (max_entries null) la ruta no consulta el conteo:
        // solo chequea inscripción previa y luego inserta.
        regatta_entries: [
          { data: null, error: null }, // no hay inscripción previa
          { data: { id: 'entry-1', sail_number: 'URU 77' }, error: null }, // insert
        ],
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({ id: 'entry-1' });
  });

  it('copia el número de vela del barco si no se envía', async () => {
    const mock = createSupabaseMock({
      profiles: activeProfile(OWNER),
      regatta_classes: snipeClass(),
      regattas: openRegatta,
      boats: snipeBoat({ sail_number: 'URU 99' }),
      regatta_entries: [
        { data: null, error: null }, // sin inscripción previa
        { data: { id: 'entry-1' }, error: null }, // insert
      ],
    });
    const app = await setup(mock);

    await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    // El insert recibió el sail_number heredado del barco.
    const insertCalls = mock.from.mock.results
      .map((r) => r.value as Record<string, { mock?: { calls: unknown[][] } }>)
      .filter((chain) => (chain.insert as { mock: { calls: unknown[][] } })?.mock?.calls?.length);
    const payload = (insertCalls.at(-1)!.insert as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0][0] as Record<string, unknown>;
    expect(payload.sail_number).toBe('URU 99');
  });
});

describe('POST /classes/:classId/register — validaciones', () => {
  it('422 si el barco es de otra clase, con mensaje claro', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass({ sailing_class: 'Snipe' }),
        regattas: openRegatta,
        boats: snipeBoat({ category: 'J/24' }), // barco de otra clase
        regatta_entries: { data: null, error: null },
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain('J/24');
    expect(res.body.error).toContain('Snipe');
  });

  it('409 si el barco ya está inscripto en esa clase', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass(),
        regattas: openRegatta,
        boats: snipeBoat(),
        regatta_entries: { data: { id: 'entry-existente', status: 'confirmed' }, error: null },
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya está inscripto/i);
  });

  it('422 si la clase no está abierta a inscripción', async () => {
    for (const status of ['upcoming', 'in_progress', 'finished', 'cancelled']) {
      const app = await setup(
        createSupabaseMock({
          profiles: activeProfile(OWNER),
          regatta_classes: snipeClass({ status }),
          regattas: openRegatta,
          boats: snipeBoat(),
          regatta_entries: { data: null, error: null },
        })
      );

      const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

      expect(res.status, `status de clase: ${status}`).toBe(422);
      expect(res.body.error).toMatch(/no están abiertas/i);
    }
  });

  it('403 si el barco no es del usuario', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OTHER),
        regatta_classes: snipeClass(),
        regattas: openRegatta,
        boats: snipeBoat({ owner_id: OWNER }), // el barco es de otro
        regatta_entries: { data: null, error: null },
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OTHER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/dueño/i);
  });

  it('422 si la clase alcanzó su cupo', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass({ max_entries: 2 }),
        regattas: openRegatta,
        boats: snipeBoat(),
        regatta_entries: [
          { data: null, error: null }, // no inscripto
          // El conteo devuelve 2 inscriptos confirmados = cupo lleno.
          {
            data: [{ regatta_class_id: CLASS_ID }, { regatta_class_id: CLASS_ID }],
            error: null,
          },
        ],
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/cupo/i);
  });

  it('deja inscribir mientras haya lugar dentro del cupo', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass({ max_entries: 3 }),
        regattas: openRegatta,
        boats: snipeBoat(),
        regatta_entries: [
          { data: null, error: null },
          { data: [{ regatta_class_id: CLASS_ID }], error: null }, // 1 de 3
          { data: { id: 'entry-1' }, error: null },
        ],
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(201);
  });

  it('400 si falta boat_id', async () => {
    const app = await setup(
      createSupabaseMock({ profiles: activeProfile(OWNER) })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({});

    expect(res.status).toBe(400);
  });

  it('404 si la clase no existe', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: { data: null, error: null },
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(404);
  });

  it('404 si el barco no existe', async () => {
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass(),
        regattas: openRegatta,
        boats: { data: null, error: null },
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(404);
  });
});

describe('POST /classes/:classId/register — ventana de inscripción', () => {
  it('422 si la inscripción todavía no abrió', async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass(),
        regattas: {
          data: { registration_opens_at: futuro, registration_closes_at: null },
          error: null,
        },
        boats: snipeBoat(),
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no abrió/i);
  });

  it('422 si la inscripción ya cerró', async () => {
    const pasado = new Date(Date.now() - 86_400_000).toISOString();
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OWNER),
        regatta_classes: snipeClass(),
        regattas: {
          data: { registration_opens_at: null, registration_closes_at: pasado },
          error: null,
        },
        boats: snipeBoat(),
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OWNER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/ya cerró/i);
  });
});

describe('POST /classes/:classId/register — orden de validaciones', () => {
  it('el estado de la clase se valida antes que la propiedad del barco', async () => {
    // Clase cerrada + barco ajeno: debe ganar el 422 de la clase.
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OTHER),
        regatta_classes: snipeClass({ status: 'finished' }),
        regattas: openRegatta,
        boats: snipeBoat({ owner_id: OWNER }),
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OTHER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no están abiertas/i);
  });

  it('la propiedad del barco se valida antes que la clase del barco', async () => {
    // Barco ajeno Y de otra clase: debe ganar el 403 de propiedad.
    const app = await setup(
      createSupabaseMock({
        profiles: activeProfile(OTHER),
        regatta_classes: snipeClass(),
        regattas: openRegatta,
        boats: snipeBoat({ owner_id: OWNER, category: 'J/24' }),
      })
    );

    const res = await request(app).post(registerUrl).set(auth(OTHER)).send({ boat_id: BOAT_ID });

    expect(res.status).toBe(403);
  });
});
