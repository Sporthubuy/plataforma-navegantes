'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { LocationPicker } from '@/components/location-picker';
import { ClubPicker } from '@/components/club-picker';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import type { AdminUserDetail } from '@/lib/types';

/**
 * Edición de un perfil desde el panel. Cubre los datos que un admin
 * necesita corregir: identidad, datos náuticos y ubicación. No toca el
 * CV profesional ni el legajo, que son del dueño.
 */
export function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUserDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [name, setName] = useState(user.name ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [sailingClass, setSailingClass] = useState(user.sailing_class ?? '');
  const [usualRole, setUsualRole] = useState(user.usual_role ?? '');
  const [clubId, setClubId] = useState<string | null>(user.club_id ?? null);
  const [country, setCountry] = useState<string | null>(user.country ?? null);
  const [city, setCity] = useState<string | null>(user.city ?? null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/admin/users/${user.id}/profile`, {
        username: username.trim(),
        name: name.trim() || null,
        bio: bio.trim() || null,
        sailing_class: sailingClass.trim() || null,
        usual_role: usualRole.trim() || null,
        club_id: clubId,
        country,
        city,
      });
      toast.success('Perfil actualizado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo guardar'));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Editar a @${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Usuario">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
          />
        </Field>

        <Field label="Nombre">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Bio">
          <Textarea
            value={bio}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Clase de vela">
            <Select
              value={sailingClass}
              onChange={(e) => setSailingClass(e.target.value)}
            >
              <option value="">Sin especificar</option>
              {BOAT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rol habitual">
            <Input
              value={usualRole}
              onChange={(e) => setUsualRole(e.target.value)}
              placeholder="Timonel, Proa…"
            />
          </Field>
        </div>

        <ClubPicker value={clubId} onChange={setClubId} label="Club" />

        <LocationPicker
          value={{ country, city }}
          onChange={(next) => {
            setCountry(next.country);
            setCity(next.city);
          }}
        />

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>
    </Modal>
  );
}
