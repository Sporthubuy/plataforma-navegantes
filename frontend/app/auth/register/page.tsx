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

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!USERNAME_RE.test(username)) {
      setError('Username inválido (3-20 caracteres: minúsculas, números o guion bajo)');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Email inválido');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: email.trim(),
        password,
        username,
        name: name.trim() || undefined,
      });
      toast.success('Cuenta creada. ¡Ahora inicia sesión!');
      router.push('/auth/login');
    } catch (err) {
      setError(getApiError(err, 'No se pudo crear la cuenta'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="mb-1 text-2xl font-bold text-navy-900 md:text-3xl">
        Crear cuenta
      </h1>
      <p className="mb-6 text-sm text-navy-500">
        Únete a la comunidad de navegantes.
      </p>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="capitana_ana"
            />
          </Field>

          <Field
            label="Nombre completo"
            hint="Opcional"
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ana García"
            />
          </Field>

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
              autoComplete="new-password"
              placeholder="Mínimo 8 caracteres"
            />
          </Field>

          <Field label="Confirmar contraseña">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder="Repite la contraseña"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} fullWidth className="mt-1">
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-sm text-navy-600">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/auth/login"
          className="font-semibold text-navy-800 hover:underline"
        >
          Inicia sesión
        </Link>
      </p>
    </AuthShell>
  );
}
