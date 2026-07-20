'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { RegattaForm, type RegattaFormData } from '@/components/regatta/regatta-form';

export default function NewRegattaPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: RegattaFormData) {
    setSubmitting(true);
    try {
      const res = await api.post('/api/regattas', data);
      toast.success('Regata creada');
      router.push(`/admin/regattas/${res.data.regatta.id}`);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo crear la regata'));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/regattas" className="text-sm text-navy-500 hover:underline">
        ← Volver
      </Link>
      <h2 className="mt-2 mb-4 text-lg font-bold text-navy-900">Crear regata</h2>
      <RegattaForm submitLabel="Crear regata" submitting={submitting} onSubmit={handleSubmit} />
    </div>
  );
}
