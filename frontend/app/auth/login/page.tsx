'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { getApiError } from '@/lib/api';
import { Navbar } from '@/components/navbar';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Completa email y contraseña');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      toast.success('¡Bienvenido a bordo!');
      router.push('/home');
    } catch (err) {
      setError(getApiError(err, 'No se pudo iniciar sesión'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pt-20 pb-10">
        <h1 className="mb-1 text-2xl font-bold text-navy-900">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-navy-500">
          Bienvenido de vuelta, navegante.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-lg bg-navy-800 py-2.5 font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>

          <Link
            href="/auth/forgot-password"
            className="text-center text-sm text-navy-500 hover:text-navy-700"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        <p className="mt-6 text-center text-sm text-navy-600">
          ¿No tienes cuenta?{' '}
          <Link
            href="/auth/register"
            className="font-semibold text-navy-800 hover:underline"
          >
            Regístrate
          </Link>
        </p>
      </main>
    </>
  );
}
