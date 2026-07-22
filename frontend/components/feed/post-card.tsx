'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { useClipboard } from '@/hooks/use-clipboard';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { relativeTime } from '@/lib/format';
import type { Post } from '@/lib/types';

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function PostCard({ post }: { post: Post }) {
  const author = post.author;
  const { copy } = useClipboard();

  // Estado optimista: el botón responde ya y se revierte si falla.
  const [liked, setLiked] = useState(post.liked_by_me ?? false);
  const [likes, setLikes] = useState(post.likes_count ?? 0);
  const [saved, setSaved] = useState(post.saved_by_me ?? false);
  const [busy, setBusy] = useState(false);

  const commentsCount = post.comments_count ?? 0;
  const recent = post.recent_comments ?? [];

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    try {
      const res = await api.post(`/api/posts/${post.id}/like`);
      setLiked(res.data.liked);
      setLikes(res.data.likes_count);
    } catch (err) {
      setLiked(prev.liked);
      setLikes(prev.likes);
      toast.error(getApiError(err, 'No se pudo registrar el me gusta'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleSave() {
    if (busy) return;
    setBusy(true);
    const prev = saved;
    setSaved(!saved);
    try {
      const res = await api.post(`/api/posts/${post.id}/save`);
      setSaved(res.data.saved);
      toast.success(res.data.saved ? 'Guardado' : 'Quitado de guardados');
    } catch (err) {
      setSaved(prev);
      toast.error(getApiError(err, 'No se pudo guardar'));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/posts/${post.id}`;
    const ok = await copy(url);
    toast[ok ? 'success' : 'error'](
      ok ? '¡Link copiado!' : 'No se pudo copiar el link'
    );
  }

  const actionBtn =
    'focus-ring flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition duration-150';

  return (
    <article className="animate-[fadeIn_300ms_ease-out] rounded-xl border border-navy-100 bg-white p-4 transition duration-150 hover:border-water-600/20 hover:shadow-md md:p-5">
      {/* Autor */}
      <div className="flex items-center gap-3">
        <Link href={author ? `/profile/${author.id}` : '#'}>
          <Avatar
            src={author?.avatar_url}
            name={author?.username ?? '?'}
            className="h-10 w-10 text-base"
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

      {/* Contenido */}
      <Link href={`/posts/${post.id}`} className="block">
        <h2 className="mt-3 text-base font-bold text-navy-900 md:text-lg">
          {post.title}
        </h2>
        <p className="mt-1 max-w-prose text-sm whitespace-pre-wrap text-navy-700 md:text-[15px]">
          {truncate(post.content, 280)}
        </p>
      </Link>

      {/* Portada 16:9 */}
      {post.image_url && (
        <Link href={`/posts/${post.id}`} className="mt-3 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            className="aspect-video w-full rounded-lg object-cover"
            loading="lazy"
          />
        </Link>
      )}

      {/* Acciones */}
      <div className="mt-3 flex items-center gap-1 border-t border-navy-50 pt-2">
        <button
          type="button"
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label="Me gusta"
          className={`${actionBtn} ${
            liked ? 'text-rose-600' : 'text-navy-500 hover:bg-navy-50'
          }`}
        >
          <Heart className="h-4 w-4" fill={liked ? 'currentColor' : 'none'} />
          {likes > 0 && <span>{likes}</span>}
        </button>

        <Link
          href={`/posts/${post.id}`}
          aria-label="Comentar"
          className={`${actionBtn} text-navy-500 hover:bg-navy-50`}
        >
          <MessageCircle className="h-4 w-4" />
          {commentsCount > 0 && <span>{commentsCount}</span>}
        </Link>

        <button
          type="button"
          onClick={share}
          aria-label="Compartir"
          className={`${actionBtn} text-navy-500 hover:bg-navy-50`}
        >
          <Share2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleSave}
          aria-pressed={saved}
          aria-label="Guardar"
          className={`${actionBtn} ml-auto ${
            saved ? 'text-water-600' : 'text-navy-500 hover:bg-navy-50'
          }`}
        >
          <Bookmark className="h-4 w-4" fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Vista previa de comentarios — se oculta en móvil por espacio. */}
      {recent.length > 0 && (
        <div className="mt-2 hidden flex-col gap-1.5 border-t border-navy-50 pt-2 sm:flex">
          {recent.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar
                src={c.author?.avatar_url}
                name={c.author?.username ?? '?'}
                className="h-6 w-6 text-[10px]"
              />
              <p className="min-w-0 text-xs text-navy-600">
                <span className="font-semibold text-navy-800">
                  {c.author?.username ?? 'alguien'}
                </span>{' '}
                {truncate(c.content, 60)}
              </p>
            </div>
          ))}
          {commentsCount > recent.length && (
            <Link
              href={`/posts/${post.id}`}
              className="text-xs font-medium text-water-600 hover:underline"
            >
              Ver los {commentsCount} comentarios
            </Link>
          )}
        </div>
      )}
    </article>
  );
}
