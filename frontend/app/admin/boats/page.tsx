'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Username } from '@/components/username';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import type { AdminBoat } from '@/lib/types';

const PAGE_SIZE = 20;

function EditBoatModal({
  boat,
  onClose,
  onSaved,
}: {
  boat: AdminBoat;
  onClose: () => void;
  onSaved: () => void;
}) {
  const knownCategory = BOAT_CATEGORIES.includes(boat.category)
    ? boat.category
    : 'Otra';
  const [name, setName] = useState(boat.name);
  const [sailNumber, setSailNumber] = useState(boat.sail_number ?? '');
  const [category, setCategory] = useState(knownCategory);
  const [customCategory, setCustomCategory] = useState(
    knownCategory === 'Otra' ? boat.category : ''
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const finalCategory = category === 'Otra' ? customCategory.trim() : category;
    if (!name.trim() || !finalCategory) {
      toast.error('Nombre y categoría son obligatorios');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/api/admin/boats/${boat.id}`, {
        name: name.trim(),
        sail_number: sailNumber.trim() || null,
        category: finalCategory,
      });
      toast.success('Barco actualizado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo actualizar'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Editar barco" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Número de vela">
          <Input
            value={sailNumber}
            onChange={(e) => setSailNumber(e.target.value)}
          />
        </Field>
        <Field label="Categoría">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {BOAT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        {category === 'Otra' && (
          <Input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            placeholder="Escribe la clase"
          />
        )}
        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Modal>
  );
}

export default function AdminBoatsPage() {
  const { hasPermission } = useAuth();
  const [boats, setBoats] = useState<AdminBoat[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<AdminBoat | null>(null);

  const canEdit = hasPermission('boats.edit_all');

  const fetchBoats = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const res = await api.get('/api/admin/boats', {
          params: {
            limit: PAGE_SIZE,
            offset: nextOffset,
            search: search.trim() || undefined,
          },
        });
        setBoats(res.data.boats);
        setTotal(res.data.pagination.total);
        setOffset(nextOffset);
      } catch {
        toast.error('No se pudieron cargar los barcos');
      } finally {
        setLoading(false);
      }
    },
    [search]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchBoats(0), 250);
    return () => clearTimeout(t);
  }, [fetchBoats]);

  async function remove(boat: AdminBoat) {
    if (!window.confirm(`¿Eliminar el barco "${boat.name}"?`)) return;
    try {
      await api.delete(`/api/admin/boats/${boat.id}`);
      toast.success('Barco eliminado');
      fetchBoats(offset);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre de barco…"
        className="rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
      />

      <p className="text-sm text-navy-500">
        {total} {total === 1 ? 'barco' : 'barcos'}
      </p>

      {loading ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : boats.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-navy-500">No hay barcos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          {boats.map((boat) => (
            <div
              key={boat.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
            >
              {boat.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boat.photo_url}
                  alt={boat.name}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-navy-100 text-xl">
                  ⛵
                </div>
              )}
              <Link href={`/boats/${boat.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold text-navy-900">
                  {boat.name}
                </p>
                <p className="truncate text-xs text-navy-400">
                  {boat.category}
                  {boat.sail_number ? ` · ${boat.sail_number}` : ''} · alta{' '}
                  {formatDate(boat.created_at)}
                </p>
                {boat.owner && (
                  <p className="truncate text-xs text-navy-400">
                    Dueño: <Username username={boat.owner.username} />
                  </p>
                )}
              </Link>
              {canEdit && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => setEditing(boat)}
                    className="rounded-lg border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => remove(boat)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Borrar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => fetchBoats(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 disabled:opacity-50"
          >
            ← Anterior
          </button>
          <span className="text-xs text-navy-400">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
          </span>
          <button
            onClick={() => fetchBoats(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
            className="rounded-lg border border-navy-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 disabled:opacity-50"
          >
            Siguiente →
          </button>
        </div>
      )}

      {editing && (
        <EditBoatModal
          boat={editing}
          onClose={() => setEditing(null)}
          onSaved={() => fetchBoats(offset)}
        />
      )}
    </div>
  );
}
