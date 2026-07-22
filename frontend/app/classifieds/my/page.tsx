'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Button, buttonClasses } from '@/components/ui/button';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Classified } from '@/lib/types';

function daysUntil(date: string): number { return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000); }

export default function MyClassifiedsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [fetching, setFetching] = useState(true);

  async function load() {
    const response = await api.get('/api/classifieds/my-classifieds');
    setClassifieds(response.data.classifieds ?? []);
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
    if (!user) return;
    let cancelled = false;
    async function fetchMine() {
      try {
        const response = await api.get('/api/classifieds/my-classifieds');
        if (!cancelled) setClassifieds(response.data.classifieds ?? []);
      } catch (error) {
        if (!cancelled) toast.error(getApiError(error, 'No se pudieron cargar tus anuncios'));
      } finally {
        if (!cancelled) setFetching(false);
      }
    }
    void fetchMine();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  async function renew(id: string) {
    try { await api.put(`/api/classifieds/${id}/renew`); toast.success('Anuncio renovado por 30 días'); await load(); } catch (error) { toast.error(getApiError(error, 'No se pudo renovar')); }
  }

  async function archive(id: string) {
    if (!window.confirm('¿Archivar este anuncio? Dejará de aparecer públicamente.')) return;
    try { await api.delete(`/api/classifieds/${id}`); toast.success('Anuncio archivado'); await load(); } catch (error) { toast.error(getApiError(error, 'No se pudo archivar')); }
  }

  if (loading || !user) return <AppShell><p className="text-navy-400">Cargando…</p></AppShell>;
  return <AppShell width="wide"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/classifieds" className="text-sm font-semibold text-navy-500">← Clasificados</Link><h1 className="mt-2 text-3xl font-bold text-navy-950">Mis anuncios</h1></div><Link href="/classifieds/new" className={buttonClasses('primary', 'sm')}>+ Publicar otro</Link></div>{fetching ? <p className="text-navy-400">Cargando anuncios…</p> : classifieds.length === 0 ? <div className="rounded-2xl border border-dashed border-navy-200 bg-white p-10 text-center"><h2 className="font-bold text-navy-900">Todavía no publicaste anuncios</h2><Link href="/classifieds/new" className={`${buttonClasses('primary', 'sm')} mt-4`}>Publicar el primero</Link></div> : <div className="space-y-3">{classifieds.map((classified) => { const days = daysUntil(classified.expires_at); const soon = classified.status === 'active' && days < 5; return <article key={classified.id} className={`rounded-2xl border bg-white p-4 shadow-sm md:p-5 ${soon ? 'border-amber-300' : 'border-navy-100'}`}>{soon && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"><span>Tu anuncio vence pronto ({Math.max(0, days)} días).</span><Button variant="warning" size="sm" onClick={() => renew(classified.id)}>Renovar</Button></div>}<div className="flex flex-col gap-4 md:flex-row md:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><Avatar src={classified.author?.avatar_url} name={user.username} className="h-11 w-11 text-sm" /><div className="min-w-0"><Link href={`/classifieds/${classified.id}`} className="block truncate font-bold text-navy-900 hover:text-sky-700">{classified.title}</Link><p className="mt-1 text-sm text-navy-500">{classified.location} · {classified.interest_count ?? 0} interesado{classified.interest_count === 1 ? '' : 's'}</p></div></div><div className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classified.status === 'active' ? 'bg-emerald-100 text-emerald-800' : classified.status === 'expired' ? 'bg-amber-100 text-amber-800' : 'bg-navy-100 text-navy-600'}`}>{classified.status === 'active' ? 'Activo' : classified.status === 'expired' ? 'Expirado' : 'Archivado'}</span><span className="text-navy-500">{classified.status === 'archived' ? 'Archivado manualmente' : `Vence ${new Date(classified.expires_at).toLocaleDateString('es-AR')}`}</span><Link href={`/classifieds/${classified.id}/edit`} className={buttonClasses('secondary', 'sm')}>Editar</Link>{classified.status !== 'archived' && (classified.status === 'expired' || days <= 7) && <Button variant="warning" size="sm" onClick={() => renew(classified.id)}>Renovar</Button>}{classified.status !== 'archived' && <Button variant="danger" size="sm" onClick={() => archive(classified.id)}>Archivar</Button>}</div></div></article>; })}</div>}</AppShell>;
}