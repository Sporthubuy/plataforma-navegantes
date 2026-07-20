'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { getApiError } from '@/lib/api';
import { AuthShell } from '@/components/auth-shell';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
    <AuthShell>
      <h1 className="mb-1 text-2xl font-bold text-navy-900 md:text-3xl">
        Iniciar sesión
      </h1>
      <p className="mb-6 text-sm text-navy-500">
        Bienvenido de vuelta, navegante.
      </p>

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

          <Field label="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} fullWidth className="mt-1">
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>

          <Link
            href="/auth/forgot-password"
            className="text-center text-sm text-navy-500 hover:text-navy-700"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-navy-600">
        ¿No tienes cuenta?{' '}
        <Link
          href="/auth/register"
          className="font-semibold text-navy-800 hover:underline"
        >
          Regístrate
        </Link>
      </p>
    </AuthShell>
  );
}
