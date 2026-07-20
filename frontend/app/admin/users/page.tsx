'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { StatusBadge, AccountTypeBadge } from '@/components/admin/badges';
import { formatDate, timeAgo } from '@/lib/format';
import type { AdminUser } from '@/lib/types';

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [accountType, setAccountType] = useState('');
  const [sort, setSort] = useState('created_at');

  const fetchUsers = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const res = await api.get('/api/admin/users', {
          params: {
            limit: PAGE_SIZE,
            offset: nextOffset,
            search: search.trim() || undefined,
            status: status || undefined,
            account_type: accountType || undefined,
            sort,
          },
        });
        setUsers(res.data.users);
        setTotal(res.data.pagination.total);
        setOffset(nextOffset);
      } catch {
        toast.error('No se pudieron cargar los usuarios');
      } finally {
        setLoading(false);
      }
    },
    [search, status, accountType, sort]
  );

  // Recarga desde el inicio cuando cambian los filtros (con debounce leve).
  useEffect(() => {
    const t = setTimeout(() => fetchUsers(0), 250);
    return () => clearTimeout(t);
  }, [fetchUsers]);

  const selectClass =
    'rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-navy-500';

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <div className="flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por username…"
          className="rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
          </select>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className={selectClass}
          >
            <option value="">Todos los tipos</option>
            <option value="sailor">Navegantes</option>
            <option value="club">Clubes</option>
            <option value="federation">Federaciones</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={selectClass}
          >
            <option value="created_at">Más recientes</option>
            <option value="last_active_at">Última actividad</option>
          </select>
        </div>
      </div>

      <p className="text-sm text-navy-500">
        {total} {total === 1 ? 'usuario' : 'usuarios'}
      </p>

      {/* Lista */}
      {loading ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : users.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-navy-500">
            No hay usuarios que coincidan con los filtros.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {users.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <Avatar
                src={u.avatar_url}
                name={u.username}
                className="h-11 w-11 text-base"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-navy-900">
                    {u.name || u.username}
                  </span>
                  <AccountTypeBadge type={u.account_type} />
                </div>
                <div className="truncate text-xs text-navy-400">
                  <Username username={u.username} className="text-xs" />
                  {u.email ? ` · ${u.email}` : ''}
                </div>
                <div className="mt-0.5 text-xs text-navy-400">
                  {u.boats_count} {u.boats_count === 1 ? 'barco' : 'barcos'} ·
                  activo {timeAgo(u.last_active_at)} · alta{' '}
                  {formatDate(u.created_at)}
                </div>
              </div>
              <StatusBadge status={u.status} />
            </Link>
          ))}
        </div>
      )}

      {/* Paginación */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => fetchUsers(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-xs text-navy-400">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <button
            onClick={() => fetchUsers(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
            className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
