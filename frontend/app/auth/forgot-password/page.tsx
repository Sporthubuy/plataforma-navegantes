'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, getApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <AuthShell>
      <h1 className="mb-1 text-2xl font-bold text-navy-900 md:text-3xl">
        Recuperar contraseña
      </h1>
      <p className="mb-6 text-sm text-navy-500">
        Te enviaremos instrucciones a tu correo.
      </p>

      {sent ? (
        <Card className="text-center">
          <p className="text-3xl">📬</p>
          <h2 className="mt-2 font-semibold text-navy-900">Revisa tu correo</h2>
          <p className="mt-1 text-sm text-navy-500">
            Si el email existe, recibirás instrucciones para recuperar tu
            contraseña.
          </p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="tu@email.com"
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              fullWidth
              className="mt-1"
            >
              {submitting ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>
          </form>
        </Card>
      )}

      <p className="mt-6 text-center text-sm text-navy-600">
        <Link
          href="/auth/login"
          className="font-semibold text-navy-800 hover:underline"
        >
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
