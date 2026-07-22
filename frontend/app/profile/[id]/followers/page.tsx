'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/cv/cv-sections';
import { EmptyState } from '@/components/empty-state';
import { formatLocation } from '@/lib/geo';

type Tab = 'followers' | 'following';

const TABS: { id: Tab; label: string }[] = [
  { id: 'followers', label: 'Seguidores' },
  { id: 'following', label: 'Siguiendo' },
];

interface FollowUser {
  id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
  verified_badge: boolean;
  country: string | null;
  city: string | null;
}

/**
 * Seguidores y seguidos de un navegante. La pestaña vive en la URL
 * (?tab=following) para que se pueda compartir el enlace directo.
 */
export default function FollowersPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-navy-400">Cargando…</p>
        </AppShell>
      }
    >
      <FollowersContent />
    </Suspense>
  );
}

function FollowersContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>(
    searchParams.get('tab') === 'following' ? 'following' : 'followers'
  );
  const [users, setUsers] = useState<FollowUser[] | null>(null);
  const [owner, setOwner] = useState<{ username: string; name: string | null } | null>(
    null
  );

  useEffect(() => {
    if (!params.id) return;
    api
      .get(`/api/users/profile/${params.id}`)
      .then((res) =>
        setOwner({ username: res.data.profile.username, name: res.data.profile.name })
      )
      .catch(() => setOwner(null));
  }, [params.id]);

  const load = useCallback(() => {
    if (!params.id) return;
    let cancelled = false;
    api
      .get(`/api/community/${params.id}/${tab}`)
      .then((res) => {
        if (!cancelled) setUsers(res.data.users);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, tab]);

  useEffect(load, [load]);

  function selectTab(next: Tab) {
    if (next === tab) return;
    setUsers(null);
    setTab(next);
  }

  const emptyText =
    tab === 'followers'
      ? 'Todavía no lo sigue nadie.'
      : 'Todavía no sigue a nadie.';

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={`/profile/${params.id}`}
          className="text-sm font-semibold text-navy-500 hover:underline"
        >
          ← Volver al perfil
        </Link>

        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold text-navy-900">
          <Users className="h-6 w-6 text-water-600" />
          {owner ? owner.name || `@${owner.username}` : 'Red'}
        </h1>

        <div className="mt-4 flex gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => selectTab(t.id)}
              className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition duration-200 ${
                tab === t.id
                  ? 'bg-water-600 text-white'
                  : 'border border-navy-100 bg-white text-navy-700 hover:bg-navy-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {users === null ? (
            <p className="text-sm text-navy-400">Cargando…</p>
          ) : users.length === 0 ? (
            <EmptyState
              title="Sin gente todavía"
              subtitle={emptyText}
              icon={<Users className="h-10 w-10 text-navy-300" />}
              actions={[{ label: 'Buscar navegantes', href: '/talent' }]}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {users.map((u) => {
                const place = formatLocation(u.city, u.country);
                return (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.id}`}
                      className="focus-ring flex items-center gap-3 rounded-xl border border-navy-100 bg-white p-3 transition duration-150 hover:border-water-600/20 hover:shadow-md"
                    >
                      <Avatar
                        src={u.avatar_url}
                        name={u.username}
                        className="h-11 w-11 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-navy-900">
                          {u.name || u.username}
                          {u.verified_badge && <VerifiedBadge className="h-4 w-4" />}
                        </p>
                        <p className="truncate text-xs text-navy-400">
                          @{u.username}
                          {place ? ` · ${place}` : ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
