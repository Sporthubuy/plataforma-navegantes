'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { formatLocation } from '@/lib/geo';
import { Avatar } from '@/components/avatar';
import { categoryLabel } from '@/components/classified-card';
import { Button, buttonClasses } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Classified, ClassifiedInterest, ClassifiedMatch } from '@/lib/types';

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function relativeDate(date: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  return days === 0 ? 'Hoy' : `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export default function ClassifiedDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [classified, setClassified] = useState<Classified | null>(null);
  const [matches, setMatches] = useState<ClassifiedMatch[]>([]);
  const [interests, setInterests] = useState<ClassifiedInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [showInterests, setShowInterests] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await api.get(`/api/classifieds/${params.id}`);
    const next = response.data.classified as Classified;
    setClassified(next);
    if (user?.id === next.author_id) {
      const [matchesResponse, interestsResponse] = await Promise.all([
        api.get(`/api/classifieds/${next.id}/matches`),
        api.get(`/api/classifieds/${next.id}/interests`),
      ]);
      setMatches(matchesResponse.data.matches ?? []);
      setInterests(interestsResponse.data.interests ?? []);
    }
  }, [params.id, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function fetchClassified() {
      try {
        const response = await api.get(`/api/classifieds/${params.id}`);
        const next = response.data.classified as Classified;
        if (cancelled) return;
        setClassified(next);
        if (user?.id === next.author_id) {
          const [matchesResponse, interestsResponse] = await Promise.all([
            api.get(`/api/classifieds/${next.id}/matches`),
            api.get(`/api/classifieds/${next.id}/interests`),
          ]);
          if (cancelled) return;
          setMatches(matchesResponse.data.matches ?? []);
          setInterests(interestsResponse.data.interests ?? []);
        }
      } catch (error) {
        if (!cancelled) toast.error(getApiError(error, 'No se pudo cargar el anuncio'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchClassified();
    return () => {
      cancelled = true;
    };
  }, [params.id, user?.id]);

  async function submitInterest() {
    setBusy(true);
    try {
      await api.post(`/api/classifieds/${params.id}/interest`, { message: message.trim() || undefined });
      toast.success('Interés enviado');
      setShowInterestModal(false);
      setMessage('');
      await load();
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo enviar el interés'));
    } finally {
      setBusy(false);
    }
  }

  async function removeInterest() {
    setBusy(true);
    try {
      await api.delete(`/api/classifieds/${params.id}/interest`);
      toast.success('Interés retirado');
      await load();
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo retirar el interés'));
    } finally {
      setBusy(false);
    }
  }

  async function renew() {
    setBusy(true);
    try {
      const response = await api.put(`/api/classifieds/${params.id}/renew`);
      setClassified((current) => current ? { ...current, ...response.data.classified } : current);
      toast.success('Anuncio renovado por 30 días');
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo renovar el anuncio'));
    } finally {
      setBusy(false);
    }
  }

  async function markMatchViewed(match: ClassifiedMatch) {
    try {
      await api.put(`/api/classifieds/matches/${match.id}/view`);
      setMatches((current) => current.map((item) => item.id === match.id ? { ...item, viewed_at: new Date().toISOString() } : item));
    } catch {
      toast.error('No se pudo marcar el match');
    }
  }

  if (loading || !classified) return <AppShell><p className="text-navy-400">Cargando anuncio…</p></AppShell>;

  const isAuthor = user?.id === classified.author_id;
  const days = daysUntil(classified.expires_at);
  const canRenew = isAuthor && classified.status !== 'archived' && days <= 7;
  const author = classified.author;

  return (
    <AppShell width="wide">
      <div className="mb-5"><Link href="/classifieds" className="text-sm font-semibold text-navy-500 hover:text-navy-800">← Volver a clasificados</Link></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main>
          <article className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
            <div className="border-b border-navy-100 bg-[linear-gradient(120deg,#e5f3f8,#f7fbfc_60%,#fff)] p-6 md:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-800">{categoryLabel(classified.category)}</span><span className="text-sm font-medium text-navy-500">{classified.status === 'active' ? (days <= 0 ? 'Vence hoy' : `Vence en ${days} días`) : 'Anuncio expirado'}</span></div>
              <h1 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-navy-950 md:text-4xl">{classified.title}</h1>
              <p className="mt-3 text-sm font-medium text-navy-500">{relativeDate(classified.created_at)} · {classified.location_worldwide ? 'Todo el mundo' : formatLocation(classified.city, classified.country)}</p>
            </div>
            <div className="space-y-7 p-6 md:p-9">
              <section><h2 className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Descripción</h2><p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-navy-700">{classified.description}</p></section>
              <section><h2 className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Se busca</h2>{classified.requirements.length === 0 ? <p className="mt-3 text-sm text-navy-500">No especificó requisitos.</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2">{classified.requirements.map((requirement) => <li key={`${requirement.requirement_type}-${requirement.requirement_value}`} className="rounded-xl bg-navy-50 px-4 py-3 text-sm font-semibold text-navy-700"><span className="mr-1 text-navy-400">{requirement.requirement_type.replace('_', ' ')}:</span>{requirement.requirement_value}</li>)}</ul>}</section>
              {(classified.contact_email || classified.contact_phone) && <section><h2 className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Contacto</h2><div className="mt-3 flex flex-wrap gap-3">{classified.contact_email && <a className={buttonClasses('secondary', 'sm')} href={`mailto:${classified.contact_email}`}>✉ {classified.contact_email}</a>}{classified.contact_phone && <a className={buttonClasses('secondary', 'sm')} href={`tel:${classified.contact_phone}`}>☎ {classified.contact_phone}</a>}</div></section>}
            </div>
          </article>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 mt-4 rounded-2xl border border-navy-100 bg-white/95 p-2 shadow-lg backdrop-blur lg:hidden">
            {isAuthor ? (
              <div className="flex gap-2">
                <Link href={`/classifieds/${classified.id}/edit`} className={`${buttonClasses('secondary', 'sm', true)}`}>Editar</Link>
                {canRenew && <Button variant="warning" size="sm" fullWidth onClick={renew} disabled={busy}>Renovar</Button>}
              </div>
            ) : classified.status === 'active' && user ? (
              classified.is_interested ? <Button variant="secondary" size="sm" fullWidth onClick={removeInterest} disabled={busy}>Ya te interesaste · Retirar</Button> : <Button size="sm" fullWidth onClick={() => setShowInterestModal(true)}>Me interesa</Button>
            ) : !user ? <Link href="/auth/login" className={buttonClasses('primary', 'sm', true)}>Ingresar para interesarte</Link> : null}
          </div>

          {isAuthor && <section className="mt-6 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm md:p-8"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Matching</p><h2 className="mt-1 text-2xl font-bold text-navy-950">Matches sugeridos</h2><p className="mt-1 text-sm text-navy-500">Ordenados por compatibilidad. Se calculan cuando los pedís.</p></div><Button size="sm" variant="secondary" onClick={async () => { setBusy(true); try { const response = await api.get(`/api/classifieds/${classified.id}/calculate-matches`); setMatches(response.data.matches ?? []); toast.success('Matches recalculados'); } catch (error) { toast.error(getApiError(error, 'No se pudieron calcular')); } finally { setBusy(false); } }} disabled={busy}>Calcular</Button></div>{matches.length === 0 ? <p className="mt-6 rounded-xl bg-navy-50 p-4 text-sm text-navy-500">Todavía no hay perfiles compatibles.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{matches.map((match) => { const profile = match.user; if (!profile) return null; return <div key={match.id} className={`rounded-xl border p-4 ${match.viewed_at ? 'border-navy-100 bg-white' : 'border-sky-200 bg-sky-50/50'}`}><div className="flex items-start gap-3"><Link href={`/profile/${profile.id}`} onClick={() => markMatchViewed(match)}><Avatar src={profile.avatar_url} name={profile.username} className="h-11 w-11 text-sm" /></Link><div className="min-w-0 flex-1"><Link href={`/profile/${profile.id}`} onClick={() => markMatchViewed(match)} className="font-bold text-navy-900 hover:text-sky-700">@{profile.username}</Link><p className="mt-1 text-xs font-bold text-emerald-700">{Math.round(Number(match.match_score))}% compatible</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-navy-500">{profile.sailing_class ?? 'Clase no indicada'} · {profile.usual_role ?? 'Rol no indicado'} · {formatLocation(profile.city, profile.country) || 'Ubicación no indicada'}</p></div></div><p className="mt-3 text-[11px] text-navy-400">Cumple una parte de los requisitos del anuncio.</p></div>; })}</div>}</section>}

          {isAuthor && <section className="mt-6 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm md:p-8"><button type="button" onClick={() => setShowInterests((current) => !current)} className="flex w-full items-center justify-between text-left"><span><span className="block text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Respuestas</span><span className="mt-1 block text-2xl font-bold text-navy-950">{interests.length} persona{interests.length === 1 ? '' : 's'} interesada{interests.length === 1 ? '' : 's'}</span></span><span className="text-2xl text-navy-400">{showInterests ? '−' : '+'}</span></button>{showInterests && <div className="mt-5 space-y-3">{interests.map((interest) => <div key={interest.id} className="flex gap-3 rounded-xl bg-navy-50 p-3"><Avatar src={interest.user?.avatar_url} name={interest.user?.username ?? '?'} className="h-9 w-9 text-xs" /><div><Link href={`/profile/${interest.user?.id}`} className="text-sm font-bold text-navy-900">@{interest.user?.username ?? 'navegante'}</Link><p className="text-xs text-navy-400">{relativeDate(interest.created_at)}</p>{interest.message && <p className="mt-2 text-sm leading-5 text-navy-600">{interest.message}</p>}</div></div>)}</div>}</section>}
        </main>

        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Publicado por</p><div className="mt-4 flex items-center gap-3"><Avatar src={author?.avatar_url} name={author?.username ?? '?'} className="h-14 w-14 text-lg" /><div className="min-w-0"><Link href={`/profile/${author?.id}`} className="font-bold text-navy-900 hover:text-sky-700">@{author?.username ?? 'navegante'}</Link><p className="truncate text-sm text-navy-500">{formatLocation(author?.city, author?.country) || formatLocation(classified.city, classified.country)}</p></div></div>{author?.bio && <p className="mt-4 text-sm leading-6 text-navy-600">{author.bio}</p>}<Link href={`/profile/${author?.id}`} className={`${buttonClasses('secondary', 'sm', true)} mt-4`}>Ver perfil</Link></section>
          <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-navy-900">{classified.interest_count ?? interests.length} interesado{(classified.interest_count ?? interests.length) === 1 ? '' : 's'}</p>{isAuthor ? <div className="mt-3 space-y-2"><Link href={`/classifieds/${classified.id}/edit`} className={`${buttonClasses('secondary', 'sm', true)}`}>Editar anuncio</Link>{canRenew && <Button variant="warning" size="sm" fullWidth onClick={renew} disabled={busy}>Renovar 30 días</Button>}</div> : classified.status === 'active' && user ? <div className="mt-3">{classified.is_interested ? <Button variant="secondary" size="sm" fullWidth onClick={removeInterest} disabled={busy}>Ya te interesaste · Retirar</Button> : <Button size="sm" fullWidth onClick={() => setShowInterestModal(true)}>Me interesa</Button>}</div> : !user && <Link href="/auth/login" className={`${buttonClasses('primary', 'sm', true)} mt-3`}>Ingresar para interesarte</Link>}</section>
        </aside>
      </div>
      {showInterestModal && <Modal title="Enviar interés" onClose={() => setShowInterestModal(false)}><p className="text-sm leading-6 text-navy-500">Podés agregar un mensaje para presentarte al autor.</p><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} className="mt-4 w-full rounded-xl border border-navy-200 p-3 text-sm text-navy-900 outline-none focus:border-navy-500" placeholder="Hola, tengo experiencia en..." /><Button fullWidth className="mt-4" onClick={submitInterest} disabled={busy}>{busy ? 'Enviando...' : 'Enviar interés'}</Button></Modal>}
    </AppShell>
  );
}