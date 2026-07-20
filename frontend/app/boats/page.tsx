'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { BoatCard } from '@/components/boat-card';
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
      <main className="flex flex-1 items-center justify-center">
        <p className="text-navy-400">Cargando…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24 md:pt-20">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy-900">Mis barcos</h1>
          <Link
            href="/boats/new"
            className="rounded-lg bg-navy-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            + Agregar barco
          </Link>
        </div>

        {boats === null ? (
          <p className="text-sm text-navy-400">Cargando barcos…</p>
        ) : boats.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-4xl">⛵</p>
            <h2 className="mt-3 font-semibold text-navy-900">
              Sin barcos todavía
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              Agrega tu barco o espera una invitación para tripular.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {boats.map((boat) => (
              <BoatCard key={`${boat.id}-${boat.relation}`} boat={boat} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
