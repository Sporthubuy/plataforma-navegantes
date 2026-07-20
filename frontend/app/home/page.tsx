'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Username } from '@/components/username';
import { Avatar } from '@/components/avatar';
import type { Post } from '@/lib/types';

const PAGE_SIZE = 20;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function truncate(text: string, max = 280): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function PostSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-navy-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-navy-100" />
          <div className="h-2.5 w-16 rounded bg-navy-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-3/4 rounded bg-navy-100" />
        <div className="h-3 w-full rounded bg-navy-100" />
        <div className="h-3 w-5/6 rounded bg-navy-100" />
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const author = post.author;
  const [comments, setComments] = useState<number | null>(null);

  useEffect(() => {
    api
      .get(`/api/posts/${post.id}/comments`)
      .then((res) => setComments(res.data.comments.length))
      .catch(() => setComments(null));
  }, [post.id]);

  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar
          src={author?.avatar_url}
          name={author?.username ?? '?'}
          className="h-10 w-10 text-base"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">
            {author?.name || author?.username || 'Usuario eliminado'}
          </p>
          <p className="truncate text-xs text-navy-400">
            <Username username={author?.username} className="text-xs" /> ·{' '}
            {timeAgo(post.created_at)}
          </p>
        </div>
      </div>

      <h2 className="mt-3 font-bold text-navy-900">{post.title}</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm text-navy-700">
        {truncate(post.content)}
      </p>

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-xl object-cover"
        />
      )}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-navy-400">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h8m-8 4h5m-9 6.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 3.5Z"
          />
        </svg>
        {comments === null ? '—' : comments}{' '}
        {comments === 1 ? 'comentario' : 'comentarios'}
      </p>
    </article>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  const fetchPage = useCallback(async (offset: number) => {
    const res = await api.get('/api/posts', {
      params: { limit: PAGE_SIZE, offset },
    });
    return res.data as { posts: Post[]; pagination: { total: number } };
  }, []);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    fetchPage(0)
      .then((data) => {
        setPosts(data.posts);
        setTotal(data.pagination.total);
      })
      .catch(() => toast.error('No se pudo cargar el feed'))
      .finally(() => setFetching(false));
  }, [user, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await fetchPage(posts.length);
      setPosts((prev) => [...prev, ...data.posts]);
      setTotal(data.pagination.total);
    } catch {
      toast.error('No se pudieron cargar más posts');
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <p className="text-navy-400">Cargando…</p>
      </main>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-24 md:pt-20">
        <h1 className="mb-4 text-xl font-bold text-navy-900">Bitácora</h1>

        {fetching ? (
          <div className="flex flex-col gap-4">
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-4xl">🌊</p>
            <h2 className="mt-3 font-semibold text-navy-900">
              Mar en calma por aquí
            </h2>
            <p className="mt-1 text-sm text-navy-500">
              Todavía no hay publicaciones. ¡Sé el primero en compartir tu
              travesía!
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {posts.length < total && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-6 w-full rounded-lg border border-navy-200 bg-white py-2.5 font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-60"
              >
                {loadingMore ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </>
        )}
      </main>
    </>
  );
}
