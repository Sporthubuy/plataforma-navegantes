import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import type { Race, Standing } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

function cellText(rp: { position: number | null; code: string | null }): string {
  if (rp.code) return rp.code;
  return rp.position != null ? String(rp.position) : '–';
}

/** Clases de una celda de manga según si se descartó o es un código. */
function cellClass(rp: { discarded: boolean; code: string | null }): string {
  if (rp.discarded) return 'text-navy-300 line-through';
  if (rp.code) return 'text-red-600';
  return 'text-navy-700';
}

/**
 * Clasificación de una clase.
 *
 * En desktop es la tabla clásica (una columna por manga). En móvil esa
 * tabla obliga a scrollear de costado con más de 4 mangas, así que cada
 * barco pasa a ser una tarjeta con las mangas como chips.
 */
export function ResultsTable({
  races,
  standings,
  effectiveDiscards = 0,
  penaltyPoints,
  highlightUserId,
}: {
  races: Race[];
  standings: Standing[];
  effectiveDiscards?: number;
  /** Puntos que vale un código especial (DNF, DSQ…) en esta clase. */
  penaltyPoints?: number;
  /** Resalta la fila del navegante que está mirando. */
  highlightUserId?: string | null;
}) {
  // Las anuladas no puntúan: no tienen columna.
  const scored = races.filter((r) => r.status !== 'abandoned');

  if (standings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-navy-200 px-4 py-8 text-center text-sm text-navy-400">
        Todavía no hay clasificación: falta cargar resultados.
      </p>
    );
  }

  const isMine = (s: Standing) =>
    !!highlightUserId && s.entry?.boat?.owner?.id === highlightUserId;

  const legend = (
    <p className="mt-2 text-xs text-navy-400">
      {effectiveDiscards > 0 ? (
        <>
          <span className="line-through">(N)</span> = manga descartada ·
          descartando {effectiveDiscards}{' '}
          {effectiveDiscards === 1 ? 'manga' : 'mangas'} · Total = neto/bruto
        </>
      ) : (
        'Low Point System: menos puntos es mejor.'
      )}
      {penaltyPoints != null && <> · DNF/DSQ = {penaltyPoints} pts</>}
    </p>
  );

  return (
    <div>
      {/* Podio: lo primero que se busca al abrir un resultado. */}
      {standings.length >= 3 && (
        <ol className="mb-3 grid grid-cols-3 gap-2">
          {standings.slice(0, 3).map((s) => (
            <li
              key={s.entry_id}
              className="flex flex-col items-center gap-1 rounded-xl border border-navy-100 bg-white p-3 text-center"
            >
              <span className="text-xl">{MEDAL[s.rank - 1]}</span>
              <span className="w-full truncate text-sm font-semibold text-navy-900">
                {s.entry?.boat?.name ?? '—'}
              </span>
              <span className="text-xs tabular-nums text-navy-400">
                {s.total} pts
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Móvil: una tarjeta por barco. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {standings.map((s) => {
          const boat = s.entry?.boat;
          const mine = isMine(s);
          return (
            <li
              key={s.entry_id}
              className={`rounded-xl border bg-white p-3 ${
                mine ? 'border-water-600 ring-1 ring-water-600/20' : 'border-navy-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-center text-lg font-bold tabular-nums text-navy-900">
                  {s.rank <= 3 ? MEDAL[s.rank - 1] : `${s.rank}º`}
                </span>
                <Avatar
                  src={boat?.owner?.avatar_url}
                  name={boat?.name ?? '?'}
                  className="h-8 w-8 shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-900">
                    {boat?.name ?? '—'}
                    {s.entry?.sail_number && (
                      <span className="ml-1 text-xs font-normal text-navy-400">
                        {s.entry.sail_number}
                      </span>
                    )}
                  </p>
                  <Username
                    username={boat?.owner?.username}
                    className="text-xs"
                  />
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-lg font-bold tabular-nums text-navy-900">
                    {s.total}
                  </span>
                  {effectiveDiscards > 0 && (
                    <span className="block text-[11px] tabular-nums text-navy-400">
                      de {s.gross_total}
                    </span>
                  )}
                </span>
              </div>

              {scored.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1 border-t border-navy-50 pt-2">
                  {scored.map((race) => {
                    const rp = s.races.find((x) => x.race_id === race.id);
                    return (
                      <li
                        key={race.id}
                        className="flex items-baseline gap-1 rounded-md bg-navy-50 px-1.5 py-0.5"
                      >
                        <span className="text-[10px] text-navy-400">
                          M{race.race_number}
                        </span>
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            rp ? cellClass(rp) : 'text-navy-300'
                          }`}
                        >
                          {rp ? cellText(rp) : '–'}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop: la tabla completa. */}
      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-navy-500">
              <th className="px-3 py-2.5 text-left font-medium">Pos</th>
              <th className="px-3 py-2.5 text-left font-medium">Barco</th>
              {scored.map((r) => (
                <th
                  key={r.id}
                  scope="col"
                  className="px-2 py-2.5 text-center font-medium"
                  title={r.name ?? `Manga ${r.race_number}`}
                >
                  M{r.race_number}
                </th>
              ))}
              <th className="px-3 py-2.5 text-center font-semibold text-navy-700">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const podium = s.rank <= 3;
              const boat = s.entry?.boat;
              const mine = isMine(s);
              return (
                <tr
                  key={s.entry_id}
                  className={`border-b border-navy-50 last:border-b-0 ${
                    mine
                      ? 'bg-water-50'
                      : podium
                        ? 'bg-navy-50/60'
                        : ''
                  }`}
                >
                  <td className="px-3 py-2.5 font-bold tabular-nums text-navy-900">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {podium && <span>{MEDAL[s.rank - 1]}</span>}
                      {s.rank}º
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={boat?.owner?.avatar_url}
                        name={boat?.name ?? '?'}
                        className="h-8 w-8 text-xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy-900">
                          {boat?.name ?? '—'}
                          {s.entry?.sail_number && (
                            <span className="ml-1 text-xs font-normal text-navy-400">
                              {s.entry.sail_number}
                            </span>
                          )}
                        </p>
                        <Username
                          username={boat?.owner?.username}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </td>
                  {scored.map((race) => {
                    const rp = s.races.find((x) => x.race_id === race.id);
                    if (!rp) {
                      return (
                        <td
                          key={race.id}
                          className="px-2 py-2.5 text-center tabular-nums text-navy-300"
                        >
                          –
                        </td>
                      );
                    }
                    return (
                      <td
                        key={race.id}
                        className={`px-2 py-2.5 text-center tabular-nums whitespace-nowrap ${cellClass(rp)}`}
                        title={rp.discarded ? 'Manga descartada' : undefined}
                      >
                        {rp.discarded ? `(${cellText(rp)})` : cellText(rp)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-navy-900">
                    {s.total}
                    {effectiveDiscards > 0 && (
                      <span className="ml-1 text-xs font-normal text-navy-400">
                        /{s.gross_total}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {legend}
    </div>
  );
}
