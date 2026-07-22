'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Username } from '@/components/username';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/format';
import type { MyBoat, Post } from '@/lib/types';

const PAGE_SIZE = 20;

function truncate(text: string, max = 280): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function PostSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-4 shadow-sm md:p-5">
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
    <article className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
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

      <h2 className="mt-3 text-base font-bold text-navy-900 md:text-lg">
        {post.title}
      </h2>
      <p className="mt-1 max-w-prose whitespace-pre-wrap text-sm text-navy-700 md:text-[15px]">
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

/** Columna lateral de accesos rápidos — visible solo en desktop (lg+). */
function QuickAccess() {
  const [boats, setBoats] = useState<MyBoat[] | null>(null);

  useEffect(() => {
    api
      .get('/api/boats/mine')
      .then((res) => setBoats(res.data.boats))
      .catch(() => setBoats([]));
  }, []);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-10 flex flex-col gap-4">
        <Card>
          <h2 className="mb-3 text-sm font-bold text-navy-900">Accesos rápidos</h2>
          <div className="flex flex-col gap-2">
            <Link
              href="/boats/new"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              ⛵ Agregar barco
            </Link>
            <Link
              href="/invitations"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              🔔 Invitaciones
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              ⚓ Mi perfil
            </Link>
          </div>
        </Card>

        {boats && boats.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-bold text-navy-900">Mis barcos</h2>
            <div className="flex flex-col gap-2">
              {boats.slice(0, 4).map((boat) => (
                <Link
                  key={`${boat.id}-${boat.relation}`}
                  href={`/boats/${boat.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-navy-50"
                >
                  {boat.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={boat.photo_url}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-100 text-sm">
                      ⛵
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-900">
                      {boat.name}
                    </span>
                    <span className="block truncate text-xs text-navy-400">
                      {boat.category}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </aside>
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
      <AppShell width="wide">
        <p className="text-navy-400">Cargando…</p>
      </AppShell>
    );
  }

  return (
    <AppShell width="wide">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
        <div className="mx-auto w-full max-w-2xl lg:mx-0">
          <h1 className="mb-4 text-2xl font-bold text-navy-900 md:text-3xl">
            Bitácora
          </h1>

          {fetching ? (
            <div className="flex flex-col gap-4">
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <Card className="p-8 text-center md:p-10">
              <p className="text-4xl">🌊</p>
              <h2 className="mt-3 font-semibold text-navy-900">
                Mar en calma por aquí
              </h2>
              <p className="mt-1 text-sm text-navy-500">
                Todavía no hay publicaciones. ¡Sé el primero en compartir tu
                travesía!
              </p>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              {posts.length < total && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-6"
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más'}
                </Button>
              )}
            </>
          )}
        </div>

        <QuickAccess />
      </div>
    </AppShell>
  );
}
