'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { BoatForm, type BoatFormData } from '@/components/boat-form';

export default function NewBoatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <AppShell width="narrow">
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  async function handleSubmit(data: BoatFormData, photo: File | null) {
    setSubmitting(true);
    try {
      const res = await api.post('/api/boats', data);
      const boatId = res.data.boat.id as string;

      if (photo) {
        const form = new FormData();
        form.append('file', photo);
        await api.post(`/api/boats/${boatId}/photo`, form);
      }

      toast.success('¡Barco agregado!');
      router.push(`/boats/${boatId}`);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo crear el barco'));
      setSubmitting(false);
    }
  }

  return (
    <AppShell width="narrow">
      <h1 className="mb-4 text-2xl font-bold text-navy-900 md:text-3xl">
        Agregar barco
      </h1>
      <BoatForm
        submitLabel="Agregar barco"
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
