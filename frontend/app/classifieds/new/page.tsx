'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { ClassifiedForm, type ClassifiedFormData } from '@/components/classified-form';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function NewClassifiedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  async function submit(data: ClassifiedFormData) {
    setSubmitting(true);
    try {
      const response = await api.post('/api/classifieds', data);
      toast.success('Anuncio publicado. Vence en 30 días.');
      router.push(`/classifieds/${response.data.classified.id}`);
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo publicar el anuncio'));
      setSubmitting(false);
    }
  }

  if (loading || !user) return <AppShell width="narrow"><p className="text-navy-400">Cargando…</p></AppShell>;
  return <AppShell width="narrow"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Nuevo anuncio</p><h1 className="mt-1 text-3xl font-bold text-navy-950">Publicá tu búsqueda</h1><p className="mt-2 text-sm leading-6 text-navy-500">Tu clasificado estará activo durante 30 días.</p></div><ClassifiedForm defaultEmail={user.email ?? ''} submitting={submitting} submitLabel="Publicar anuncio" onSubmit={submit} /></AppShell>;
}