'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { api, getApiError } from '@/lib/api';
import type { ClassifiedProfile, ProfileStats } from '@/lib/types';

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ClassifiedProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/api/users/profile/${params.id}`),
      api.get(`/api/users/profile/${params.id}/stats`),
    ]).then(([profileResponse, statsResponse]) => {
      setProfile(profileResponse.data.profile);
      setStats(statsResponse.data.stats);
    }).catch((error) => toast.error(getApiError(error, 'No se pudo cargar el perfil')));
  }, [params.id]);

  if (!profile) return <AppShell><p className="text-navy-400">Cargando perfil…</p></AppShell>;
  return <AppShell width="default"><Link href="/classifieds" className="text-sm font-semibold text-navy-500">← Volver</Link><Card className="mt-5 overflow-hidden p-0"><div className="h-28 bg-[linear-gradient(120deg,#17324d,#2c7181_60%,#d7aa62)]" /><div className="p-6 md:p-8"><div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end"><Avatar src={profile.avatar_url} name={profile.username} className="h-24 w-24 border-4 border-white text-2xl" /><div><h1 className="text-2xl font-bold text-navy-950">{profile.name || `@${profile.username}`}</h1><p className="font-semibold text-sky-700">@{profile.username}</p></div></div>{profile.bio && <p className="mt-6 max-w-2xl text-[15px] leading-7 text-navy-700">{profile.bio}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-3">{[['Clase', profile.sailing_class], ['Rol habitual', profile.usual_role], ['Zona', profile.location]].map(([label, value]) => <div key={label} className="rounded-xl bg-navy-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-navy-400">{label}</p><p className="mt-1 text-sm font-semibold text-navy-800">{value || 'No indicado'}</p></div>)}</div>{stats && <div className="mt-6 flex flex-wrap gap-6 border-t border-navy-100 pt-5 text-sm text-navy-600"><span><strong className="text-navy-900">{stats.boats_owned}</strong> barcos</span><span><strong className="text-navy-900">{stats.crews_joined}</strong> tripulaciones</span><span>Desde {new Date(stats.member_since).toLocaleDateString('es-AR')}</span></div>}</div></Card></AppShell>;
}