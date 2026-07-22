'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bookmark,
  LogOut,
  ShieldAlert,
  Palette,
  UserPen,
  Globe,
  Clock,
  Languages,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input, Field, Select } from '@/components/ui/input';
import { PostCard } from '@/components/feed/post-card';
import { usePrefs, COMMON_TIMEZONES, LOCALES } from '@/lib/prefs';
import { COUNTRIES } from '@/lib/geo';
import type { Post } from '@/lib/types';

export default function SettingsPage() {
  const { user, loading, logout, updateUser } = useAuth();
  const router = useRouter();
  const { prefs, update } = usePrefs();

  const [saved, setSaved] = useState<Post[]>([]);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const isPublic = user?.public_profile !== false;
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/posts/saved/mine')
      .then((res) => setSaved(res.data.posts))
      .catch(() => setSaved([]));
  }, [user]);

  async function togglePrivacy(value: boolean) {
    if (!user) return;
    setSavingPrivacy(true);
    try {
      await api.put(`/api/users/profile/${user.id}`, {
        public_profile: value,
      });
      updateUser({ public_profile: value });
      toast.success(value ? 'Perfil público' : 'Perfil privado');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo cambiar la visibilidad'));
    } finally {
      setSavingPrivacy(false);
    }
  }

  async function deleteAccount() {
    if (!user) return;
    setDeleting(true);
    try {
      await api.delete(`/api/users/profile/${user.id}`);
      toast.success('Cuenta eliminada');
      logout();
      router.replace('/');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar la cuenta'));
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !user) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl">
        <h1 className="sr-only">Ajustes</h1>

        {/* Apariencia */}
        <Card className="mb-4">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <Palette className="h-4 w-4 text-navy-400" />
            Apariencia
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Elegí el tema. Con &quot;Sistema&quot; sigue la preferencia de tu
            equipo.
          </p>
          <div className="mt-3">
            <ThemeToggle />
          </div>
        </Card>

        {/* Cuenta */}
        <Card>
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <UserPen className="h-4 w-4 text-navy-400" />
            Cuenta
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Tu perfil público: avatar, bio, datos náuticos y redes.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/profile"
              className="focus-ring rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-800"
            >
              Editar perfil
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                router.replace('/');
              }}
              className="focus-ring flex items-center gap-1.5 rounded-lg border border-navy-200 px-3.5 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </div>
        </Card>

        {/* Privacidad */}
        <Card className="mt-4">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <Lock className="h-4 w-4 text-navy-400" />
            Privacidad
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Elegí si tu CV náutico es visible para toda la comunidad.
          </p>

          <label className="mt-4 flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              disabled={savingPrivacy}
              onClick={() => togglePrivacy(!isPublic)}
              className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                isPublic ? 'bg-water-600' : 'bg-navy-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  isPublic ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span>
              <span className="block text-sm font-medium text-navy-800">
                {savingPrivacy
                  ? 'Guardando…'
                  : isPublic
                    ? 'Perfil público'
                    : 'Perfil privado'}
              </span>
              <span className="block text-xs text-navy-500">
                {isPublic
                  ? 'Tu historial, credenciales y datos náuticos son visibles para cualquier navegante.'
                  : 'Solo ven tu nombre, avatar y titular. El resto queda privado.'}
              </span>
            </span>
          </label>
        </Card>

        {/* Preferencias */}
        <Card className="mt-4">
          <h2 className="flex items-center gap-2 font-semibold text-navy-900">
            <Globe className="h-4 w-4 text-navy-400" />
            Preferencias
          </h2>
          <p className="mt-1 text-sm text-navy-500">
            Personalizá cómo ves la plataforma. Se guardan en este dispositivo.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="País" hint="Para sugerencias y formularios.">
              <Select
                value={prefs.country}
                onChange={(e) => update({ country: e.target.value })}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="Idioma">
              <Select
                value={prefs.locale}
                onChange={(e) => update({ locale: e.target.value })}
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Zona horaria"
                hint="Las fechas y horarios se muestran con esta zona."
              >
                <Select
                  value={prefs.timezone}
                  onChange={(e) => update({ timezone: e.target.value })}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-navy-400">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Zona: {prefs.timezone}
            </span>
            <span className="inline-flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" />
              Idioma: {LOCALES.find((l) => l.code === prefs.locale)?.label ?? prefs.locale}
            </span>
          </div>
        </Card>

        {/* Guardados */}
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
            <Bookmark className="h-5 w-5 text-water-600" />
            Guardados ({saved.length})
          </h2>
          {saved.length === 0 ? (
            <p className="mt-2 text-sm text-navy-400">
              Todavía no guardaste ninguna entrada. Usá el marcador en cualquier
              publicación del feed.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {saved.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>

        {/* Zona peligrosa */}
        <Card className="mt-8 border border-red-200">
          <h2 className="flex items-center gap-2 font-semibold text-red-700">
            <ShieldAlert className="h-4 w-4" />
            Eliminar cuenta
          </h2>
          <p className="mt-1 text-sm text-navy-600">
            Se borran tu perfil, tus barcos y tus publicaciones.{' '}
            <strong>Esta acción no se puede deshacer.</strong> Escribí tu usuario{' '}
            <code className="rounded bg-navy-50 px-1">{user.username}</code> para
            confirmar.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={user.username}
              aria-label="Confirmar usuario"
            />
            <Button
              variant="danger"
              onClick={deleteAccount}
              disabled={confirm !== user.username || deleting}
              className="shrink-0"
            >
              {deleting ? 'Eliminando…' : 'Eliminar cuenta'}
            </Button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}