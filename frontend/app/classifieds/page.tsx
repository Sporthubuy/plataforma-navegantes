'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { ClassifiedCard } from '@/components/classified-card';
import { Button } from '@/components/ui/button';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Classified } from '@/lib/types';

const inputClass =
  'rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100';
const locations = ['Río de la Plata, Uruguay', 'Montevideo', 'Mar del Plata', 'Buenos Aires', 'Punta del Este'];

export default function ClassifiedsPage() {
  const { user } = useAuth();
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/classifieds', { params: { category, location, search, sort, limit: 30 } })
      .then((response) => {
        if (cancelled) return;
        setClassifieds(response.data.classifieds ?? []);
        setTotal(response.data.pagination?.total ?? 0);
      })
      .catch((error) => {
        if (!cancelled) toast.error(getApiError(error, 'No se pudieron cargar los clasificados'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, location, search, sort]);

  return (
    <AppShell width="wide">
      <header className="relative mb-7 overflow-hidden rounded-3xl bg-navy-900 px-5 py-7 text-white shadow-[0_18px_40px_rgba(20,38,61,0.16)] md:px-8 md:py-9">
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-water-100">Tablón de navegantes</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Encontrá tu próxima tripulación</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-navy-100 md:text-base">Oportunidades, barcos y personas para que la próxima salida empiece antes de tocar el agua.</p>
        </div>
        {user && <div className="relative mt-5 flex flex-wrap gap-2"><Link href="/classifieds/new" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-bold text-navy-900 transition hover:bg-water-50">+ Publicar anuncio</Link><Link href="/classifieds/my" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10">Mis anuncios</Link></div>}
      </header>

      <section className="mb-6 rounded-2xl border border-navy-100 bg-white p-3 shadow-sm md:p-4">
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div><p className="text-sm font-bold text-navy-900">Encontrá anuncios</p><p className="text-xs text-navy-500">Filtrá por zona, categoría o palabra.</p></div>
          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((current) => !current)} aria-expanded={filtersOpen}>{filtersOpen ? 'Ocultar' : 'Filtrar'}</Button>
        </div>
        <div className={`${filtersOpen ? 'mt-4' : 'hidden'} grid gap-3 md:mt-0 md:grid md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end`}>
          <label className="text-xs font-bold uppercase tracking-wide text-navy-500">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)} className={`${inputClass} mt-1.5 w-full`}><option value="">Todas</option><option value="tripulante">Tripulante</option><option value="profesor">Profesor</option><option value="barco">Barco</option><option value="otro">Otro</option></select></label>
          <label className="text-xs font-bold uppercase tracking-wide text-navy-500">Ubicación<input list="classified-list-locations" value={location} onChange={(event) => setLocation(event.target.value)} className={`${inputClass} mt-1.5 w-full`} placeholder="Montevideo" /><datalist id="classified-list-locations">{locations.map((item) => <option key={item} value={item} />)}</datalist></label>
          <label className="text-xs font-bold uppercase tracking-wide text-navy-500">Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} mt-1.5 w-full`} placeholder="Proa, regata, ILCA..." /></label>
          <label className="text-xs font-bold uppercase tracking-wide text-navy-500">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value)} className={`${inputClass} mt-1.5 w-full`}><option value="recent">Recientes</option><option value="views">Más vistos</option>{user && <option value="score_desc">Mejor match</option>}</select></label>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-navy-500"><span className="text-navy-900">{total}</span> anuncio{total === 1 ? '' : 's'} activos</p><Button variant="ghost" size="sm" onClick={() => { setCategory(''); setLocation(''); setSearch(''); setSort('recent'); }}>Limpiar filtros</Button></div>
      {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="h-64 animate-pulse rounded-2xl bg-white/70" /><div className="hidden h-64 animate-pulse rounded-2xl bg-white/70 sm:block" /><div className="hidden h-64 animate-pulse rounded-2xl bg-white/70 xl:block" /></div> : classifieds.length === 0 ? <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-10 text-center"><p className="text-4xl">⚓</p><h2 className="mt-3 text-lg font-bold text-navy-900">No encontramos anuncios</h2><p className="mt-1 text-sm text-navy-500">Probá cambiar los filtros o publicá el primero.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{classifieds.map((classified) => <ClassifiedCard key={classified.id} classified={classified} />)}</div>}
    </AppShell>
  );
}