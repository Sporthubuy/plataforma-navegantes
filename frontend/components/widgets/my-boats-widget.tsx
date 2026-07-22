'use client';

import Link from 'next/link';
import { Anchor, Plus } from 'lucide-react';
import { Widget, WidgetEmpty } from './widget-shell';
import type { MyBoat } from '@/lib/types';

/**
 * Estado de un barco, derivado de lo que ya sabemos sin pedir más
 * datos: si el usuario es tripulante es que el barco tiene tripulación.
 */
function boatStatus(boat: MyBoat): { label: string; className: string } {
  if (boat.relation === 'crew') {
    return { label: 'Tripulando', className: 'bg-water-50 text-water-600' };
  }
  return { label: 'Activo', className: 'bg-sage-100 text-sage-700' };
}

export function MyBoatsWidget({ boats }: { boats: MyBoat[] }) {
  return (
    <Widget title="Mis barcos" icon={Anchor} seeAllHref="/boats">
      {boats.length === 0 ? (
        <WidgetEmpty
          text="Todavía no tienes barcos."
          actionLabel="Agregar barco"
          actionHref="/boats/new"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {boats.slice(0, 4).map((boat) => {
            const status = boatStatus(boat);
            return (
              <li key={`${boat.id}-${boat.relation}`}>
                <Link
                  href={`/boats/${boat.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-water-50"
                >
                  {boat.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={boat.photo_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-sm">
                      ⛵
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-navy-900">
                      {boat.name}
                    </span>
                    <span className="block truncate text-xs text-navy-400">
                      {boat.category}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/boats/new"
        className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-dashed border-navy-200 py-1.5 text-xs font-medium text-navy-500 hover:border-water-600/40 hover:text-water-600"
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar barco
      </Link>
    </Widget>
  );
}
