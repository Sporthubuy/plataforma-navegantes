'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { Input } from '@/components/ui/input';
import { formatLocation } from '@/lib/geo';
import type { ModeratedItem } from '@/lib/types';

type Kind = 'posts' | 'comments' | 'classifieds' | 'activities';

const TABS: { id: Kind; label: string; searchable: boolean }[] = [
  { id: 'posts', label: 'Publicaciones', searchable: true },
  { id: 'comments', label: 'Comentarios', searchable: false },
  { id: 'classifieds', label: 'Clasificados', searchable: true },
  { id: 'activities', label: 'Salidas', searchable: false },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-UY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Resumen legible de un ítem según su tipo. */
function itemSummary(kind: Kind, item: ModeratedItem): string {
  switch (kind) {
    case 'posts':
      return item.title ?? '(sin título)';
    case 'comments':
      return item.content ?? '';
    case 'classifieds':
      return `${item.title ?? ''}${item.status ? ` · ${item.status}` : ''}`;
    case 'activities':
      return `${item.distance_nm ?? '—'} millas · ${item.hours ?? '—'} h${
        item.sailing_class ? ` · ${item.sailing_class}` : ''
      }`;
  }
}

function ContentModeration() {
  const searchParams = useSearchParams();
  const initial = (searchParams.get('tab') as Kind) || 'posts';

  const [kind, setKind] = useState<Kind>(
    TABS.some((t) => t.id === initial) ? initial : 'posts'
  );
  const [items, setItems] = useState<ModeratedItem[] | null>(null);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    const params: Record<string, string> = {};
    if (search.trim()) params.search = search.trim();
    api
      .get(`/api/admin/content/${kind}`, { params })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.pagination.total);
      })
      .catch(() => setItems([]));
  }, [kind, search]);

  // Debounce liviano para la búsqueda.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function selectTab(next: Kind) {
    if (next === kind) return;
    setItems(null);
    setSearch('');
    setKind(next);
  }

  async function remove(item: ModeratedItem) {
    const who = (item.author ?? item.user)?.username ?? 'este usuario';
    if (
      !confirm(
        `¿Borrar este contenido de @${who}? No se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/admin/content/${kind}/${item.id}`);
      toast.success('Contenido eliminado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar'));
    }
  }

  const activeTab = TABS.find((t) => t.id === kind)!;

  return (
    <div>
      <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => selectTab(t.id)}
            className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              kind === t.id
                ? 'bg-navy-800 text-white'
                : 'border border-navy-100 bg-white text-navy-600 hover:bg-navy-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab.searchable && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título…"
          aria-label="Buscar contenido"
          className="mb-4 max-w-sm"
        />
      )}

      {items === null ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-navy-400">No hay contenido para moderar.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-navy-400">{total} en total</p>
          <ul className="flex flex-col gap-2">
            {items.map((item) => {
              const author = item.author ?? item.user;
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-3"
                >
                  {author ? (
                    <Link href={`/profile/${author.id}`} className="shrink-0">
                      <Avatar
                        src={author.avatar_url}
                        name={author.username}
                        className="h-9 w-9"
                      />
                    </Link>
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-navy-100" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy-900">
                      {itemSummary(kind, item)}
                    </p>
                    {(item.content || item.description || item.notes) && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-navy-500">
                        {item.content || item.description || item.notes}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-navy-400">
                      @{author?.username ?? 'desconocido'} ·{' '}
                      {formatDate(item.created_at)}
                      {kind === 'classifieds' &&
                        formatLocation(item.city ?? null, item.country ?? null) &&
                        ` · ${formatLocation(item.city ?? null, item.country ?? null)}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(item)}
                    aria-label="Borrar contenido"
                    className="focus-ring shrink-0 rounded-lg p-2 text-navy-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AdminContentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-navy-400">Cargando…</p>}>
      <ContentModeration />
    </Suspense>
  );
}
