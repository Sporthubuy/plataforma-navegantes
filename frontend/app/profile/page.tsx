'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import type { User } from '@/lib/types';

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ProfilePage() {
  const { user, loading, logout, updateUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ username: '', name: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Requiere sesión.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  // Carga el perfil completo (incluye created_at).
  useEffect(() => {
    if (!user) return;
    api
      .get(`/api/users/profile/${user.id}`)
      .then((res) => setProfile(res.data.profile))
      .catch(() => toast.error('No se pudo cargar el perfil'));
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-navy-400">Cargando…</p>
      </main>
    );
  }

  const shown = profile ?? user;

  function startEditing() {
    setForm({
      username: shown.username,
      name: shown.name ?? '',
      bio: shown.bio ?? '',
    });
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put(`/api/users/profile/${user!.id}`, {
        username: form.username,
        name: form.name.trim() || null,
        bio: form.bio.trim() || null,
      });
      setProfile(res.data.profile);
      updateUser(res.data.profile);
      setEditing(false);
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar el perfil'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      '¿Seguro que quieres eliminar tu cuenta? Esta acción no se puede deshacer.'
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await api.delete(`/api/users/profile/${user!.id}`);
      logout();
      toast.success('Cuenta eliminada');
      router.replace('/auth/login');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar la cuenta'));
      setDeleting(false);
    }
  }

  const inputClass =
    'rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200';

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24 md:pt-20">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {shown.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shown.avatar_url}
                alt={shown.username}
                className="h-20 w-20 rounded-full border-2 border-navy-100 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-navy-800 text-3xl font-bold text-white">
                {shown.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-navy-900">
                {shown.name || shown.username}
              </h1>
              <p className="truncate text-sm text-navy-500">@{shown.username}</p>
              {profile?.created_at && (
                <p className="mt-1 text-xs text-navy-400">
                  A bordo desde el {formatDate(profile.created_at)}
                </p>
              )}
            </div>
          </div>

          {editing ? (
            <form onSubmit={handleSave} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
                Username
                <input
                  value={form.username}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, username: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
                Nombre
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  rows={3}
                  className={inputClass}
                  placeholder="Cuéntanos sobre ti y tu barco…"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-navy-800 py-2.5 font-semibold text-white hover:bg-navy-700 disabled:opacity-60"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-navy-200 py-2.5 font-semibold text-navy-700 hover:bg-navy-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="mt-5 whitespace-pre-wrap text-sm text-navy-700">
                {shown.bio || 'Sin bio todavía. ¡Cuéntanos sobre ti!'}
              </p>
              <button
                onClick={startEditing}
                className="mt-5 w-full rounded-lg bg-navy-800 py-2.5 font-semibold text-white hover:bg-navy-700"
              >
                Editar perfil
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={() => {
              logout();
              router.replace('/auth/login');
            }}
            className="rounded-lg border border-navy-200 bg-white py-2.5 font-semibold text-navy-700 hover:bg-navy-50"
          >
            Cerrar sesión
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg border border-red-200 bg-white py-2.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {deleting ? 'Eliminando…' : 'Eliminar cuenta'}
          </button>
        </div>
      </main>
    </>
  );
}
