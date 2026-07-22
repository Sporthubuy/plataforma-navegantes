'use client';

import { useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { LocationPicker } from '@/components/location-picker';
import { ClubPicker } from '@/components/club-picker';
import type { Regatta } from '@/lib/types';

export interface RegattaFormData {
  name: string;
  description: string | null;
  country: string | null;
  city: string | null;
  club_id: string | null;
  start_date: string;
  end_date: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  photo_url: string | null;
}

/** datetime-local <-> ISO. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function RegattaForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Regatta;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (data: RegattaFormData) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [country, setCountry] = useState<string | null>(initial?.country ?? null);
  const [city, setCity] = useState<string | null>(initial?.city ?? null);
  const [clubId, setClubId] = useState<string | null>(initial?.club_id ?? null);
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [opensAt, setOpensAt] = useState(
    toLocalInput(initial?.registration_opens_at ?? null)
  );
  const [closesAt, setClosesAt] = useState(
    toLocalInput(initial?.registration_closes_at ?? null)
  );
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('El nombre es obligatorio');
    if (!startDate || !endDate) return setError('Las fechas son obligatorias');
    if (new Date(endDate) < new Date(startDate))
      return setError('La fecha de fin no puede ser anterior a la de inicio');

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      country,
      city,
      club_id: clubId,
      start_date: startDate,
      end_date: endDate,
      registration_opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      registration_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      photo_url: photoUrl.trim() || null,
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre del campeonato *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campeonato de Verano 2026"
          />
        </Field>
        <Field label="Descripción">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </Field>
        <LocationPicker
          value={{ country, city }}
          onChange={(next) => {
            setCountry(next.country);
            setCity(next.city);
            // Un club de otro país deja de tener sentido como sede.
            if (next.country !== country) setClubId(null);
          }}
          cityLabel="Ciudad / sede"
        />
        <ClubPicker
          value={clubId}
          onChange={setClubId}
          label="Club organizador"
          country={country}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio *">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Fin *">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Apertura inscripción">
            <Input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
            />
          </Field>
          <Field label="Cierre inscripción">
            <Input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
            />
          </Field>
        </div>
        <Field label="URL de la foto (opcional)">
          <Input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" disabled={submitting} fullWidth>
          {submitting ? 'Guardando…' : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
