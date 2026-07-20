'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { getApiError } from '@/lib/api';
import { Navbar } from '@/components/navbar';

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

  const inputClass =
    'rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200';

  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pt-20 pb-10">
        <h1 className="mb-1 text-2xl font-bold text-navy-900">Crear cuenta</h1>
        <p className="mb-6 text-sm text-navy-500">
          Únete a la comunidad de navegantes.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className={inputClass}
              placeholder="capitana_ana"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Nombre completo <span className="font-normal text-navy-400">(opcional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className={inputClass}
              placeholder="Ana García"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className={inputClass}
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
            Confirmar contraseña
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
              placeholder="Repite la contraseña"
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
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-navy-600">
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/auth/login"
            className="font-semibold text-navy-800 hover:underline"
          >
            Inicia sesión
          </Link>
        </p>
      </main>
    </>
  );
}
