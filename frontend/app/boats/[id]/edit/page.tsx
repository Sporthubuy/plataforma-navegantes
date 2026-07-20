'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { BoatForm, type BoatFormData } from '@/components/boat-form';
import type { Boat } from '@/lib/types';

export default function EditBoatPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [boat, setBoat] = useState<Boat | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !params.id) return;
    api
      .get(`/api/boats/${params.id}`)
      .then((res) => {
        if (res.data.boat.owner_id !== user.id) {
          toast.error('Solo el dueño puede editar el barco');
          router.replace(`/boats/${params.id}`);
          return;
        }
        setBoat(res.data.boat);
      })
      .catch(() => {
        toast.error('Barco no encontrado');
        router.replace('/boats');
      });
  }, [user, params.id, router]);

  if (loading || !user || !boat) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-navy-400">Cargando…</p>
      </main>
    );
  }

  async function handleSubmit(data: BoatFormData, photo: File | null) {
    setSubmitting(true);
    try {
      await api.put(`/api/boats/${boat!.id}`, data);
      if (photo) {
        const form = new FormData();
        form.append('file', photo);
        await api.post(`/api/boats/${boat!.id}/photo`, form);
      }
      toast.success('Barco actualizado');
      router.push(`/boats/${boat!.id}`);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo actualizar el barco'));
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-24 md:pt-20">
        <h1 className="mb-4 text-xl font-bold text-navy-900">Editar barco</h1>
        <BoatForm
          initial={boat}
          submitLabel="Guardar cambios"
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </main>
    </>
  );
}
