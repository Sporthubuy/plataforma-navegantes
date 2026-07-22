'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { QuickActionBar } from '@/components/quick-action-bar';
import { FeedCard } from '@/components/feed/feed-card';
import { FeedSkeleton } from '@/components/feed/feed-skeleton';
import { PostComposer } from '@/components/feed/post-composer';
import { RightSidebar } from '@/components/sidebar/right-sidebar';
import {
  EmptyState,
  CalmSeaIllustration,
} from '@/components/empty-state';
import { useFeed } from '@/hooks/use-feed';
import type { MyBoat, Regatta } from '@/lib/types';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [composerOpen, setComposerOpen] = useState(false);

  // Datos que alimentan la columna derecha.
  const [regattas, setRegattas] = useState<Regatta[]>([]);
  const [boats, setBoats] = useState<MyBoat[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);

  const { sentinelRef, ...feed } = useFeed(!!user);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const loadSidebar = useCallback(() => {
    api
      .get('/api/regattas', { params: { limit: 10 } })
      .then((res) => setRegattas(res.data.regattas))
      .catch(() => setRegattas([]));
    api
      .get('/api/boats/mine')
      .then((res) => setBoats(res.data.boats))
      .catch(() => setBoats([]));
    api
      .get('/api/crew/invitations')
      .then((res) => setPendingInvites(res.data.invitations.length))
      .catch(() => setPendingInvites(0));
  }, []);

  useEffect(() => {
    if (user) loadSidebar();
  }, [user, loadSidebar]);

  if (loading || !user) {
    return (
      <AppShell width="wide">
        <FeedSkeleton />
      </AppShell>
    );
  }

  return (
    <AppShell width="wide">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="mx-auto w-full max-w-2xl lg:mx-0">
          <h1 className="mb-4 text-2xl font-bold text-navy-900 md:text-3xl">
            Inicio
          </h1>

          <QuickActionBar onNewPost={() => setComposerOpen(true)} />

          {feed.loading ? (
            <FeedSkeleton />
          ) : feed.error ? (
            <EmptyState
              title="No se pudo cargar el feed"
              subtitle={feed.error}
              icon={<CalmSeaIllustration />}
              actions={[{ label: 'Reintentar', href: '/home' }]}
            />
          ) : feed.items.length === 0 ? (
            <EmptyState
              title="Tu mar está en calma"
              subtitle="Aún no hay actividad. Empieza compartiendo tu primera travesía o explora la comunidad."
              icon={<CalmSeaIllustration />}
              actions={[
                { label: 'Explorar regatas', href: '/regattas' },
                { label: 'Explorar', href: '/explore', variant: 'secondary' },
              ]}
            />
          ) : (
            <>
              <div className="flex flex-col gap-4">
                {feed.items.map((item) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    onResolved={feed.removeItem}
                  />
                ))}
              </div>

              {/* Centinela del scroll infinito */}
              <div ref={sentinelRef} className="h-1" />
              {feed.loadingMore && (
                <div className="mt-4">
                  <FeedSkeleton count={1} />
                </div>
              )}
              {!feed.hasMore && feed.items.length > 3 && (
                <p className="mt-6 text-center text-xs text-navy-400">
                  Llegaste al final del feed.
                </p>
              )}
            </>
          )}
        </div>

        <RightSidebar
          regattas={regattas}
          boats={boats}
          pendingInvites={pendingInvites}
          location={user.location}
        />
      </div>

      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onCreated={() => {
            feed.reload();
          }}
        />
      )}
    </AppShell>
  );
}
