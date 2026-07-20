'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/home' : '/auth/login');
  }, [user, loading, router]);

  return (
    <main className="flex flex-1 items-center justify-center">
      <p className="text-navy-400">Cargando…</p>
    </main>
  );
}
