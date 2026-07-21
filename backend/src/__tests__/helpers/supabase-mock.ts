import { vi } from 'vitest';

/**
 * Mock del cliente de Supabase.
 *
 * El cliente real encadena métodos (`.from(t).select().eq().maybeSingle()`)
 * y a veces se hace `await` directo sobre la cadena. Este helper devuelve
 * un objeto encadenable donde:
 *  - cualquier método de filtro devuelve la misma cadena,
 *  - `maybeSingle()` / `single()` resuelven la respuesta configurada,
 *  - la cadena es *thenable*, así `await query` también resuelve.
 *
 * Las respuestas se configuran POR TABLA. Si se pasa un array, cada
 * llamada consecutiva a esa tabla consume el siguiente elemento (útil
 * cuando una ruta consulta la misma tabla varias veces con distinta
 * intención).
 */

export interface SupabaseResponse {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
}

type TableConfig = Record<string, SupabaseResponse | SupabaseResponse[]>;

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'in',
  'ilike',
  'gte',
  'lte',
  'order',
  'limit',
  'range',
];

function makeChain(response: SupabaseResponse) {
  const settled = {
    data: response.data ?? null,
    error: response.error ?? null,
    count: response.count ?? null,
  };

  const chain: Record<string, unknown> = {};
  for (const m of CHAIN_METHODS) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => settled);
  chain.single = vi.fn(async () => settled);
  // Thenable: permite `await supabase.from(...).select(...)` sin single().
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(settled).then(resolve, reject);

  return chain;
}

export function createSupabaseMock(tables: TableConfig = {}) {
  // Cola de respuestas por tabla (se consumen en orden).
  const queues = new Map<string, SupabaseResponse[]>();
  for (const [table, cfg] of Object.entries(tables)) {
    queues.set(table, Array.isArray(cfg) ? [...cfg] : [cfg]);
  }

  const calls: string[] = [];

  const from = vi.fn((table: string) => {
    calls.push(table);
    const queue = queues.get(table);
    if (!queue || queue.length === 0) {
      // Sin configurar: respuesta vacía (no rompe la ruta).
      return makeChain({ data: null, error: null, count: 0 });
    }
    // El último elemento se repite si se consulta de más.
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    return makeChain(next);
  });

  return {
    from,
    /** Tablas consultadas, en orden — útil para asertar el flujo. */
    calls,
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: { path: 'x' }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'http://x/y.png' } })),
      })),
    },
    auth: {
      admin: {
        deleteUser: vi.fn(async () => ({ data: null, error: null })),
        getUserById: vi.fn(async () => ({
          data: { user: { email: 'test@test.com' } },
          error: null,
        })),
        createUser: vi.fn(async () => ({
          data: { user: { id: 'new-user' } },
          error: null,
        })),
      },
    },
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
