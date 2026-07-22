'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { UpcomingRegattasWidget } from '@/components/widgets/upcoming-regattas-widget';
import { ClassifiedMatchesWidget } from '@/components/widgets/classified-matches-widget';
import { MyBoatsWidget } from '@/components/widgets/my-boats-widget';
import { QuickAccessWidget } from '@/components/widgets/quick-access-widget';
import { WeatherWidget } from '@/components/widgets/weather-widget';
import type { MyBoat, Regatta } from '@/lib/types';

interface SidebarData {
  regattas: Regatta[];
  boats: MyBoat[];
  pendingInvites: number;
  location?: string | null;
}

function Widgets({ regattas, boats, pendingInvites, location }: SidebarData) {
  return (
    <div className="flex flex-col gap-4">
      <UpcomingRegattasWidget regattas={regattas} />
      <ClassifiedMatchesWidget />
      <MyBoatsWidget boats={boats} />
      <WeatherWidget location={location} />
      <QuickAccessWidget pendingInvites={pendingInvites} />
    </div>
  );
}

/**
 * Columna derecha de widgets. En desktop es una columna sticky; en
 * móvil se accede con un botón flotante que abre un drawer.
 */
export function RightSidebar(props: SidebarData) {
  const [open, setOpen] = useState(false);

  // Con el drawer abierto no debe scrollear el fondo.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <Widgets {...props} />
        </div>
      </aside>

      {/* Móvil: botón flotante */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir panel lateral"
        className="focus-ring fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-white shadow-lg transition hover:bg-navy-800 lg:hidden"
      >
        <LayoutGrid className="h-5 w-5" />
      </button>

      {/* Móvil: drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Cerrar panel"
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] animate-[fadeIn_200ms_ease-out] overflow-y-auto rounded-t-2xl bg-navy-50 p-4 pb-safe shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-navy-900">Panel</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-full p-1.5 text-navy-500 hover:bg-navy-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Widgets {...props} />
          </div>
        </div>
      )}
    </>
  );
}
