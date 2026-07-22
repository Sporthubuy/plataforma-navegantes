'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Heart, Share2, Bookmark } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { useClipboard } from '@/hooks/use-clipboard';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/empty-state';
import { relativeTime } from '@/lib/format';
import type { Post, PostComment } from '@/lib/types';

export default function PostDetailPage() {
  const { user, loading } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { copy } = useClipboard();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/posts/${params.id}`)
      .then((res) => {
        const p: Post = res.data.post;
        setPost(p);
        setLiked(p.liked_by_me ?? false);
        setLikes(p.likes_count ?? 0);
        setSaved(p.saved_by_me ?? false);
      })
      .catch(() => setNotFound(true));
    api
      .get(`/api/posts/${params.id}/comments`)
      .then((res) => setComments(res.data.comments))
      .catch(() => setComments([]));
  }, [params.id]);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function toggleLike() {
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    try {
      const res = await api.post(`/api/posts/${params.id}/like`);
      setLiked(res.data.liked);
      setLikes(res.data.likes_count);
    } catch (err) {
      setLiked(prev.liked);
      setLikes(prev.likes);
      toast.error(getApiError(err, 'No se pudo registrar el me gusta'));
    }
  }

  async function toggleSave() {
    const prev = saved;
    setSaved(!saved);
    try {
      const res = await api.post(`/api/posts/${params.id}/save`);
      setSaved(res.data.saved);
    } catch (err) {
      setSaved(prev);
      toast.error(getApiError(err, 'No se pudo guardar'));
    }
  }

  async function share() {
    const ok = await copy(window.location.href);
    toast[ok ? 'success' : 'error'](ok ? '¡Link copiado!' : 'No se pudo copiar');
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/posts/${params.id}/comments`, {
        content: draft.trim(),
      });
      setDraft('');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo comentar'));
    } finally {
      setSending(false);
    }
  }

  if (notFound) {
    return (
      <AppShell>
        <EmptyState
          title="Entrada no encontrada"
          subtitle="Puede que la hayan borrado."
          actions={[{ label: 'Volver al inicio', href: '/home' }]}
        />
      </AppShell>
    );
  }

  if (loading || !user || !post) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  const author = post.author;

  return (
    <AppShell>
      <Link href="/home" className="text-sm text-navy-500 hover:underline">
        ← Volver al inicio
      </Link>

      <article className="mt-3 rounded-xl border border-navy-100 bg-white p-5 md:p-6">
        <div className="flex items-center gap-3">
          <Link href={author ? `/profile/${author.id}` : '#'}>
            <Avatar
              src={author?.avatar_url}
              name={author?.username ?? '?'}
              className="h-11 w-11 text-base"
            />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy-900">
              {author?.name || author?.username || 'Usuario eliminado'}
            </p>
            <p className="truncate text-xs text-navy-400">
              <Username username={author?.username} className="text-xs" /> ·{' '}
              {relativeTime(post.created_at)}
            </p>
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold text-navy-900 md:text-3xl">
          {post.title}
        </h1>
        <p className="mt-2 max-w-prose text-[15px] whitespace-pre-wrap text-navy-700">
          {post.content}
        </p>

        {post.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.image_url}
            alt=""
            className="mt-4 w-full rounded-xl object-cover"
          />
        )}

        <div className="mt-4 flex items-center gap-2 border-t border-navy-50 pt-3">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            aria-label="Me gusta"
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium ${
              liked ? 'text-rose-600' : 'text-navy-500 hover:bg-navy-50'
            }`}
          >
            <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
            {likes > 0 && likes}
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Compartir"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-500 hover:bg-navy-50"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label="Guardar"
            className={`ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium ${
              saved ? 'text-water-600' : 'text-navy-500 hover:bg-navy-50'
            }`}
          >
            <Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
      </article>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-navy-900">
          Comentarios ({comments.length})
        </h2>

        <Card className="mb-4">
          <form onSubmit={addComment} className="flex flex-col gap-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Escribí un comentario…"
            />
            <Button type="submit" size="sm" disabled={sending} className="self-start">
              {sending ? 'Enviando…' : 'Comentar'}
            </Button>
          </form>
        </Card>

        {comments.length === 0 ? (
          <p className="text-sm text-navy-400">
            Todavía no hay comentarios. Sé el primero.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((c) => (
              <Card key={c.id} className="flex items-start gap-3 p-3" padded={false}>
                <Avatar
                  src={c.author?.avatar_url}
                  name={c.author?.username ?? '?'}
                  className="h-8 w-8 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-navy-400">
                    <Username username={c.author?.username} className="text-xs" />{' '}
                    · {relativeTime(c.created_at)}
                  </p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap text-navy-700">
                    {c.content}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
