'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { BoatCard } from '@/components/boat-card';
import { Card } from '@/components/ui/card';
import { buttonClasses } from '@/components/ui/button';
import type { MyBoat } from '@/lib/types';

export default function BoatsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [boats, setBoats] = useState<MyBoat[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/boats/mine')
      .then((res) => setBoats(res.data.boats))
      .catch(() => {
        setBoats([]);
        toast.error('No se pudieron cargar tus barcos');
      });
  }, [user]);

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* El nombre de la sección ya está en la navegación: el título
          queda solo para lectores de pantalla. */}
      <h1 className="sr-only">Mis barcos</h1>

      <div className="mb-5 flex items-center justify-end gap-3">
        <Link href="/boats/new" className={buttonClasses('primary', 'sm')}>
          + Agregar barco
        </Link>
      </div>

      {boats === null ? (
        <p className="text-sm text-navy-400">Cargando barcos…</p>
      ) : boats.length === 0 ? (
        <Card className="p-8 text-center md:p-10">
          <p className="text-4xl">⛵</p>
          <h2 className="mt-3 font-semibold text-navy-900">
            Sin barcos todavía
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Agrega tu barco o espera una invitación para tripular.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {boats.map((boat) => (
            <BoatCard key={`${boat.id}-${boat.relation}`} boat={boat} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
