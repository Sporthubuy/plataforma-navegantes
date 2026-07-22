'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { COUNTRIES, DEFAULT_COUNTRY, citiesOf, countryName, flagEmoji } from '@/lib/geo';
import type { Club } from '@/lib/types';

interface ClubForm {
  name: string;
  short_name: string;
  country: string;
  city: string;
  website: string;
}

const EMPTY: ClubForm = {
  name: '',
  short_name: '',
  country: DEFAULT_COUNTRY,
  city: '',
  website: '',
};

function ClubModal({
  club,
  onClose,
  onSaved,
}: {
  club: Club | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClubForm>(
    club
      ? {
          name: club.name,
          short_name: club.short_name ?? '',
          country: club.country,
          city: club.city ?? '',
          website: club.website ?? '',
        }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const set = (changes: Partial<ClubForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const cities = citiesOf(form.country);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        country: form.country,
        city: form.city.trim() || null,
        website: form.website.trim() || null,
      };
      if (club) {
        await api.put(`/api/clubs/${club.id}`, body);
        toast.success('Club actualizado');
      } else {
        await api.post('/api/clubs', body);
        toast.success('Club creado');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar el club'));
      setSaving(false);
    }
  }

  return (
    <Modal title={club ? 'Editar club' : 'Nuevo club'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre *">
          <Input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Yacht Club Uruguayo"
            required
          />
        </Field>

        <Field label="Sigla" hint="Opcional: YCU, CNPE…">
          <Input
            value={form.short_name}
            onChange={(e) => set({ short_name: e.target.value })}
            maxLength={20}
            placeholder="YCU"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="País *">
            <Select
              value={form.country}
              // Cambiar de país invalida la ciudad elegida.
              onChange={(e) => set({ country: e.target.value, city: '' })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Ciudad">
            {cities.length > 0 ? (
              <Select
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
              >
                <option value="">Sin especificar</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                value={form.city}
                onChange={(e) => set({ city: e.target.value })}
                placeholder="Escribí la ciudad"
              />
            )}
          </Field>
        </div>

        <Field label="Sitio web">
          <Input
            type="url"
            value={form.website}
            onChange={(e) => set({ website: e.target.value })}
            placeholder="https://…"
          />
        </Field>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : club ? 'Guardar cambios' : 'Crear club'}
        </Button>
      </form>
    </Modal>
  );
}

export default function AdminClubsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('clubs.manage');

  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ club: Club | null } | null>(null);

  const load = useCallback(() => {
    api
      .get('/api/clubs')
      .then((res) => setClubs(res.data.clubs))
      .catch(() => setClubs([]));
  }, []);

  useEffect(load, [load]);

  async function remove(club: Club) {
    if (
      !confirm(
        `¿Eliminar "${club.name}"? Los perfiles y barcos que lo tengan elegido quedarán sin club.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/api/clubs/${club.id}`);
      toast.success('Club eliminado');
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo eliminar el club'));
    }
  }

  const term = search.trim().toLowerCase();
  const shown = (clubs ?? []).filter(
    (c) =>
      !term ||
      c.name.toLowerCase().includes(term) ||
      (c.short_name ?? '').toLowerCase().includes(term) ||
      (c.city ?? '').toLowerCase().includes(term)
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar club, sigla o ciudad…"
          aria-label="Buscar club"
          className="max-w-sm"
        />
        {canManage && (
          <Button size="sm" onClick={() => setModal({ club: null })}>
            <Plus className="h-4 w-4" />
            Nuevo club
          </Button>
        )}
      </div>

      {!canManage && (
        <p className="mb-4 rounded-lg bg-sand-100 px-3 py-2 text-sm text-sand-700">
          Solo podés ver el catálogo: para editarlo hace falta el permiso{' '}
          <code>clubs.manage</code>.
        </p>
      )}

      {clubs === null ? (
        <p className="text-sm text-navy-400">Cargando…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-navy-400">
          {term ? 'Ningún club coincide con la búsqueda.' : 'Todavía no hay clubes.'}
        </p>
      ) : (
        <Card padded={false} className="divide-y divide-navy-50">
          {shown.map((club) => (
            <div
              key={club.id}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-900">
                  {club.name}
                  {club.short_name && (
                    <span className="ml-2 rounded bg-navy-50 px-1.5 py-0.5 text-xs font-medium text-navy-500">
                      {club.short_name}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-navy-400">
                  {flagEmoji(club.country)} {club.city ?? countryName(club.country)}
                  {club.website && ` · ${club.website}`}
                </p>
              </div>

              {canManage && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setModal({ club })}
                    aria-label={`Editar ${club.name}`}
                    className="focus-ring rounded-lg p-2 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(club)}
                    aria-label={`Eliminar ${club.name}`}
                    className="focus-ring rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {modal && (
        <ClubModal
          club={modal.club}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </>
  );
}
