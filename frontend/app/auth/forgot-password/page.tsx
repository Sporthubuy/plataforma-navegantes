'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, getApiError } from '@/lib/api';
import { Navbar } from '@/components/navbar';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Ingresa tu email');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(getApiError(err, 'No se pudo enviar el correo'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pt-20 pb-10">
        <h1 className="mb-1 text-2xl font-bold text-navy-900">
          Recuperar contraseña
        </h1>
        <p className="mb-6 text-sm text-navy-500">
          Te enviaremos instrucciones a tu correo.
        </p>

        {sent ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-3xl">📬</p>
            <h2 className="mt-2 font-semibold text-navy-900">Revisa tu correo</h2>
            <p className="mt-1 text-sm text-navy-500">
              Si el email existe, recibirás instrucciones para recuperar tu
              contraseña.
            </p>
          </div>
        ) : (
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
              {submitting ? 'Enviando…' : 'Enviar instrucciones'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-navy-600">
          <Link
            href="/auth/login"
            className="font-semibold text-navy-800 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </main>
    </>
  );
}
