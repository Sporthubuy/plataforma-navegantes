'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { useClipboard } from '@/hooks/use-clipboard';
import { Avatar } from '@/components/avatar';
import { relativeTime } from '@/lib/format';
import { FeedItemShell, FeedActionButton } from './feed-item-shell';
import type { Post } from '@/lib/types';

const TYPE_STYLE = {
  label: 'Publicación',
  badge: 'bg-navy-100 text-navy-700',
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function PostCard({ post }: { post: Post }) {
  const author = post.author;
  const { copy } = useClipboard();

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
    toast[ok ? 'success' : 'error'](ok ? '¡Link copiado!' : 'No se pudo copiar el link');
  }

  const footer = (
    <div className="flex items-center gap-3">
      <FeedActionButton
        icon={<Heart className="h-3.5 w-3.5" fill={liked ? 'currentColor' : 'none'} />}
        count={likes}
        active={liked}
        activeClass="text-rose-600"
        onClick={toggleLike}
        ariaLabel="Me gusta"
        disabled={busy}
      />
      <FeedActionButton
        icon={<MessageCircle className="h-3.5 w-3.5" />}
        count={commentsCount}
        href={`/posts/${post.id}`}
        ariaLabel="Comentar"
      />
      <FeedActionButton
        icon={<Share2 className="h-3.5 w-3.5" />}
        onClick={share}
        ariaLabel="Compartir"
      />
      <FeedActionButton
        icon={<Bookmark className="h-3.5 w-3.5" fill={saved ? 'currentColor' : 'none'} />}
        active={saved}
        activeClass="text-water-600"
        onClick={toggleSave}
        ariaLabel="Guardar"
        disabled={busy}
      />
    </div>
  );

  return (
    <FeedItemShell
      typeStyle={TYPE_STYLE}
      actor={
        author
          ? {
              name: author.name || author.username,
              username: author.username,
              avatar_url: author.avatar_url,
              href: `/profile/${author.id}`,
            }
          : null
      }
      time={relativeTime(post.created_at)}
      footer={footer}
    >
      <Link href={`/posts/${post.id}`} className="block">
        <h2 className="text-[15px] font-semibold leading-snug text-navy-950">{post.title}</h2>
        <p className="mt-0.5 line-clamp-3 text-sm text-navy-500 leading-relaxed">
          {truncate(post.content, 280)}
        </p>
      </Link>

      {post.image_url && (
        <Link
          href={`/posts/${post.id}`}
          className="mt-2 block overflow-hidden rounded-lg border border-navy-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            className="aspect-video w-full object-cover transition hover:opacity-95"
            loading="lazy"
          />
        </Link>
      )}

      {recent.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {recent.map((c) => (
            <div key={c.id} className="flex items-start gap-1.5">
              <Avatar
                src={c.author?.avatar_url}
                name={c.author?.username ?? '?'}
                className="h-5 w-5 text-[9px]"
              />
              <p className="min-w-0 text-xs text-navy-600">
                <span className="font-semibold text-navy-800">{c.author?.username ?? 'alguien'}</span>{' '}
                {truncate(c.content, 60)}
              </p>
            </div>
          ))}
          {commentsCount > recent.length && (
            <Link href={`/posts/${post.id}`} className="text-xs font-medium text-water-600 hover:underline">
              Ver los {commentsCount} comentarios
            </Link>
          )}
        </div>
      )}
    </FeedItemShell>
  );
}