'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Avatar } from '@/components/avatar';
import { Username } from '@/components/username';
import { StatusBadge, AccountTypeBadge } from '@/components/admin/badges';
import { formatDate, formatDateTime, timeAgo } from '@/lib/format';
import type { AdminUserDetail, PermissionCatalogItem } from '@/lib/types';

const GRANT_PERMISSION = 'users.grant_permissions';

export default function AdminUserDetailPage() {
  const { user: me, hasPermission } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const isSelf = !!me && me.id === params.id;
  const canManagePermissions = hasPermission(GRANT_PERMISSION);

  const load = useCallback(() => {
    api
      .get(`/api/admin/users/${params.id}`)
      .then((res) => setDetail(res.data.user))
      .catch(() => setNotFound(true));
  }, [params.id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!canManagePermissions) return;
    api
      .get('/api/admin/permissions/catalog')
      .then((res) => setCatalog(res.data.catalog))
      .catch(() => setCatalog([]));
  }, [canManagePermissions]);

  async function suspend() {
    const reason = window.prompt('Motivo de la suspensión (opcional):') ?? '';
    setBusy(true);
    try {
      await api.put(`/api/admin/users/${params.id}/suspend`, { reason });
      toast.success('Usuario suspendido');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo suspender'));
    } finally {
      setBusy(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    try {
      await api.put(`/api/admin/users/${params.id}/reactivate`);
      toast.success('Usuario reactivado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo reactivar'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `¿Eliminar definitivamente a @${detail?.username}? Se borrarán sus barcos y datos. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/api/admin/users/${params.id}`);
      toast.success('Usuario eliminado');
      router.replace('/admin/users');
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar'));
      setBusy(false);
    }
  }

  async function togglePermission(permission: string, has: boolean) {
    setBusy(true);
    try {
      if (has) {
        await api.delete(`/api/admin/users/${params.id}/permissions/${permission}`);
      } else {
        await api.post(`/api/admin/users/${params.id}/permissions`, {
          permission,
        });
      }
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo actualizar el permiso'));
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="font-semibold text-navy-900">Usuario no encontrado</p>
        <Link
          href="/admin/users"
          className="mt-3 inline-block text-sm text-navy-500 underline"
        >
          Volver a la lista
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-navy-400">Cargando…</p>;
  }

  // Coincide con el backend: solo quien puede otorgar permisos está
  // protegido de ser suspendido/eliminado.
  const targetIsAdmin = detail.permissions.includes(GRANT_PERMISSION);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/users"
        className="text-sm text-navy-500 hover:underline"
      >
        ← Volver a usuarios
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      {/* Ficha */}
      <div className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
        <div className="flex items-center gap-4">
          <Avatar
            src={detail.avatar_url}
            name={detail.username}
            className="h-20 w-20 text-3xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-navy-900">
                {detail.name || detail.username}
              </h2>
              <StatusBadge status={detail.status} />
              <AccountTypeBadge type={detail.account_type} />
            </div>
            <div className="mt-0.5">
              <Username username={detail.username} className="text-sm" />
            </div>
            {detail.email && (
              <p className="truncate text-sm text-navy-500">{detail.email}</p>
            )}
          </div>
        </div>

        {detail.bio && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-navy-700">
            {detail.bio}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-navy-400">Alta</dt>
            <dd className="text-navy-700">{formatDate(detail.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-navy-400">Última actividad</dt>
            <dd className="text-navy-700">{timeAgo(detail.last_active_at)}</dd>
          </div>
        </dl>

        {detail.status === 'suspended' && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">
              Suspendido el {formatDateTime(detail.suspended_at)}
            </p>
            {detail.suspended_reason && (
              <p className="mt-0.5">Motivo: {detail.suspended_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Acciones de cuenta */}
      {(hasPermission('users.suspend') || hasPermission('users.delete')) && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-bold text-navy-900">Acciones</h3>
          {isSelf ? (
            <p className="text-sm text-navy-400">
              No puedes aplicar acciones administrativas sobre tu propia cuenta.
            </p>
          ) : targetIsAdmin ? (
            <p className="text-sm text-navy-400">
              Este usuario es administrador: no puede ser suspendido ni
              eliminado.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {hasPermission('users.suspend') &&
                (detail.status === 'active' ? (
                  <button
                    onClick={suspend}
                    disabled={busy}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Suspender
                  </button>
                ) : (
                  <button
                    onClick={reactivate}
                    disabled={busy}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Reactivar
                  </button>
                ))}
              {hasPermission('users.delete') && (
                <button
                  onClick={remove}
                  disabled={busy}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Eliminar cuenta
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Permisos */}
      {canManagePermissions && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-1 font-bold text-navy-900">Permisos</h3>
          <p className="mb-3 text-xs text-navy-400">
            Otorga o revoca permisos de administración a este usuario.
          </p>
          <div className="flex flex-col gap-2">
            {catalog.map((item) => {
              const has = detail.permissions.includes(item.permission);
              const lockSelfGrant =
                isSelf && item.permission === GRANT_PERMISSION && has;
              return (
                <label
                  key={item.permission}
                  className="flex items-start gap-3 rounded-lg border border-navy-100 p-3"
                >
                  <input
                    type="checkbox"
                    checked={has}
                    disabled={busy || lockSelfGrant}
                    onChange={() => togglePermission(item.permission, has)}
                    className="mt-0.5 h-4 w-4 accent-navy-800 disabled:opacity-50"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold text-navy-800">
                      {item.permission}
                    </span>
                    <span className="block text-xs text-navy-500">
                      {item.description}
                    </span>
                    {lockSelfGrant && (
                      <span className="mt-0.5 block text-xs text-amber-600">
                        No puedes quitarte este permiso a ti mismo.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Barcos */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-bold text-navy-900">
          Barcos ({detail.boats.length})
        </h3>
        {detail.boats.length === 0 ? (
          <p className="text-sm text-navy-400">Este usuario no tiene barcos.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.boats.map((boat) => (
              <Link
                key={boat.id}
                href={`/boats/${boat.id}`}
                className="flex items-center gap-3 rounded-lg border border-navy-100 p-2 hover:bg-navy-50"
              >
                {boat.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={boat.photo_url}
                    alt={boat.name}
                    className="h-10 w-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-100">
                    ⛵
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy-900">
                    {boat.name}
                  </p>
                  <p className="truncate text-xs text-navy-400">
                    {boat.category}
                    {boat.sail_number ? ` · ${boat.sail_number}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
