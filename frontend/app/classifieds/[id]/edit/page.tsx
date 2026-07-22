'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { AppShell } from '@/components/app-shell';
import { ClassifiedForm, type ClassifiedFormData } from '@/components/classified-form';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Classified } from '@/lib/types';

export default function EditClassifiedPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [classified, setClassified] = useState<Classified | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api.get(`/api/classifieds/${params.id}`).then((response) => {
      const next = response.data.classified as Classified;
      if (next.author_id !== user.id) {
        toast.error('Solo el autor puede editar este anuncio');
        router.replace(`/classifieds/${params.id}`);
        return;
      }
      setClassified(next);
    }).catch((error) => toast.error(getApiError(error, 'No se pudo cargar el anuncio')));
  }, [params.id, user, router]);

  async function submit(data: ClassifiedFormData) {
    setSubmitting(true);
    try {
      await api.put(`/api/classifieds/${params.id}`, data);
      toast.success('Anuncio actualizado');
      router.push(`/classifieds/${params.id}`);
    } catch (error) {
      toast.error(getApiError(error, 'No se pudo actualizar el anuncio'));
      setSubmitting(false);
    }
  }

  if (loading || !user || !classified) return <AppShell width="narrow"><p className="text-navy-400">Cargando anuncio…</p></AppShell>;
  return <AppShell width="narrow"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Editar clasificado</p><h1 className="mt-1 text-3xl font-bold text-navy-950">Ajustá tu anuncio</h1></div><ClassifiedForm classified={classified} defaultEmail={user.email ?? ''} submitting={submitting} submitLabel="Guardar cambios" onSubmit={submit} /></AppShell>;
}