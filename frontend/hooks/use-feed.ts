'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { MAX_CLASSIFIEDS_PER_PAGE, type FeedItem } from '@/types/feed';
import type {
  Classified,
  CommunityActivity,
  Invitation,
  Post,
  Regatta,
  RegattaHistoryItem,
} from '@/lib/types';

const PAGE_SIZE = 10;

/**
 * Intercala items para que el feed no quede monótono: nunca deja tres
 * del mismo tipo seguidos. Recorre por prioridad y, si el candidato
 * repetiría el tipo por tercera vez, busca el siguiente de otro tipo.
 */
export function interleave(items: FeedItem[]): FeedItem[] {
  const pending = [...items];
  const out: FeedItem[] = [];

  while (pending.length > 0) {
    const lastTwo = out.slice(-2);
    const blocked =
      lastTwo.length === 2 && lastTwo[0].type === lastTwo[1].type
        ? lastTwo[0].type
        : null;

    let index = pending.findIndex((it) => it.type !== blocked);
    if (index === -1) index = 0; // solo queda el tipo bloqueado
    out.push(pending[index]);
    pending.splice(index, 1);
  }

  return out;
}

interface FeedState {
  items: FeedItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

/**
 * Feed de la home. La primera tanda mezcla todos los tipos; las
 * siguientes traen solo posts (lo accionable ya se mostró arriba).
 * Paginación por offset, que es lo que expone la API de posts.
 */
export function useFeed(enabled: boolean) {
  const [state, setState] = useState<FeedState>({
    items: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    error: null,
  });
  const offsetRef = useRef(0);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  // Cambiarlo vuelve a disparar el efecto de carga (recarga manual).
  const [reloadToken, setReloadToken] = useState(0);

  const fetchFirstPage = useCallback(async (): Promise<FeedState> => {
    try {
      // Todo en paralelo: el feed no debe esperar en cascada.
      const [posts, regattas, classifieds, invitations, activities, history] =
        await Promise.all([
          api.get('/api/posts', { params: { limit: PAGE_SIZE, offset: 0 } }),
          api.get('/api/regattas', { params: { limit: 5 } }).catch(() => null),
          api
            .get('/api/classifieds', { params: { limit: 5, status: 'active' } })
            .catch(() => null),
          api.get('/api/crew/invitations').catch(() => null),
          api
            .get('/api/community/activities', { params: { limit: 8 } })
            .catch(() => null),
          api.get('/api/users/me').then(
            (me) =>
              api
                .get(`/api/users/${me.data.profile.id}/regatta-history`)
                .catch(() => null),
            () => null
          ),
        ]);

      const postItems: FeedItem[] = (posts.data.posts as Post[]).map((p) => ({
        id: `post-${p.id}`,
        type: 'post',
        data: p,
      }));

      // Solo regatas por venir y no canceladas.
      const today = new Date().toISOString().slice(0, 10);
      const regattaItems: FeedItem[] = ((regattas?.data.regattas ??
        []) as Regatta[])
        .filter((r) => r.status !== 'cancelled' && r.end_date >= today)
        .slice(0, 3)
        .map((r) => ({ id: `regatta-${r.id}`, type: 'regatta', data: r }));

      const classifiedItems: FeedItem[] = ((classifieds?.data.classifieds ??
        []) as Classified[])
        .slice(0, MAX_CLASSIFIEDS_PER_PAGE)
        .map((c) => ({ id: `classified-${c.id}`, type: 'classified', data: c }));

      const inviteItems: FeedItem[] = ((invitations?.data.invitations ??
        []) as Invitation[]).map((i) => ({
        id: `invite-${i.id}`,
        type: 'crew_invite',
        data: i,
      }));

      const activityItems: FeedItem[] = ((activities?.data.activities ??
        []) as CommunityActivity[]).map((a) => ({
        id: `activity-${a.id}`,
        type: 'activity',
        data: a,
      }));

      const achievementItems: FeedItem[] = ((history?.data.history ??
        []) as RegattaHistoryItem[])
        .filter((h) => h.position != null)
        .slice(0, 3)
        .map((h) => ({
          id: `achievement-${h.entry_id}`,
          type: 'achievement',
          data: h,
        }));

      const mixed = interleave([
        ...inviteItems,
        ...achievementItems,
        ...activityItems,
        ...regattaItems,
        ...classifiedItems,
        ...postItems,
      ]);

      offsetRef.current = postItems.length;
      return {
        items: mixed,
        loading: false,
        loadingMore: false,
        hasMore: posts.data.pagination.total > postItems.length,
        error: null,
      };
    } catch {
      return {
        items: [],
        loading: false,
        loadingMore: false,
        hasMore: false,
        error: 'No se pudo cargar el feed',
      };
    }
  }, []);

  const loadMore = useCallback(async () => {
    setState((s) => {
      if (s.loadingMore || !s.hasMore) return s;
      return { ...s, loadingMore: true };
    });

    try {
      const res = await api.get('/api/posts', {
        params: { limit: PAGE_SIZE, offset: offsetRef.current },
      });
      const newPosts = res.data.posts as Post[];
      offsetRef.current += newPosts.length;

      setState((s) => ({
        ...s,
        items: [
          ...s.items,
          ...newPosts.map(
            (p): FeedItem => ({ id: `post-${p.id}`, type: 'post', data: p })
          ),
        ],
        loadingMore: false,
        hasMore: res.data.pagination.total > offsetRef.current,
      }));
    } catch {
      setState((s) => ({ ...s, loadingMore: false }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchFirstPage().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchFirstPage, reloadToken]);

  // Infinite scroll con IntersectionObserver (sin dependencias extra).
  useEffect(() => {
    if (!sentinel || !state.hasMore || state.loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinel, state.hasMore, state.loading, state.items.length, loadMore]);

  /** Quita un item del feed (ej: una invitación ya respondida). */
  const removeItem = useCallback((id: string) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }));
  }, []);

  /** Recarga la primera tanda desde cero (ej: tras publicar una entrada). */
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    setReloadToken((t) => t + 1);
  }, []);

  return { ...state, sentinelRef: setSentinel, reload, removeItem };
}
