'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bookmark,
  LogOut,
  Settings as SettingsIcon,
  ShieldAlert,
  UserPen,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PostCard } from '@/components/feed/post-card';
import type { Post } from '@/lib/types';

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [saved, setSaved] = useState<Post[]>([]);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

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
        <h1 className="flex items-center gap-2 text-2xl font-bold text-navy-900 md:text-3xl">
          <SettingsIcon className="h-6 w-6 text-water-600" />
          Ajustes
        </h1>

        <Card className="mt-5">
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
