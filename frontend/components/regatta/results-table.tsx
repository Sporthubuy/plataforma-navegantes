import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import type { Race, Standing } from '@/lib/types';

const MEDAL = ['🥇', '🥈', '🥉'];

function cellText(rp: { position: number | null; code: string | null }): string {
  if (rp.code) return rp.code;
  return rp.position != null ? String(rp.position) : '–';
}

export function ResultsTable({
  races,
  standings,
  effectiveDiscards = 0,
  penaltyPoints,
}: {
  races: Race[];
  standings: Standing[];
  effectiveDiscards?: number;
  /** Puntos que vale un código especial (DNF, DSQ…) en esta clase. */
  penaltyPoints?: number;
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-navy-500">
              <th className="px-3 py-2.5 text-left font-medium">Pos</th>
              <th className="px-3 py-2.5 text-left font-medium">Barco</th>
              {races.map((r) => (
                <th
                  key={r.id}
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
              return (
                <tr
                  key={s.entry_id}
                  className={`border-b border-navy-50 last:border-b-0 ${
                    podium ? 'bg-navy-50/60' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 font-bold text-navy-900">
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
                  {races.map((race) => {
                    const rp = s.races.find((x) => x.race_id === race.id);
                    if (!rp) {
                      return (
                        <td key={race.id} className="px-2 py-2.5 text-center text-navy-300">
                          –
                        </td>
                      );
                    }
                    return (
                      <td
                        key={race.id}
                        className={`px-2 py-2.5 text-center whitespace-nowrap ${
                          rp.discarded
                            ? 'text-navy-300 line-through'
                            : rp.code
                              ? 'text-red-600'
                              : 'text-navy-700'
                        }`}
                        title={rp.discarded ? 'Manga descartada' : undefined}
                      >
                        {rp.discarded ? `(${cellText(rp)})` : cellText(rp)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center font-bold text-navy-900">
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
        {penaltyPoints != null && (
          <> · DNF/DSQ = {penaltyPoints} pts</>
        )}
      </p>
    </div>
  );
}
