'use client';

import { useState, type FormEvent } from 'react';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select } from '@/components/ui/input';
import type { Regatta } from '@/lib/types';

const CLASSES = BOAT_CATEGORIES.filter((c) => c !== 'Otra');

export interface RegattaFormData {
  name: string;
  description: string | null;
  sailing_class: string;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  max_entries: number | null;
  discards_count: number;
  photo_url: string | null;
}

/** datetime-local <-> ISO helpers. */
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
  lockClass,
  onSubmit,
}: {
  initial?: Regatta;
  submitLabel: string;
  submitting: boolean;
  lockClass?: boolean;
  onSubmit: (data: RegattaFormData) => void;
}) {
  const knownClass =
    initial && CLASSES.includes(initial.sailing_class)
      ? initial.sailing_class
      : initial
        ? 'Otra'
        : '';
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [classSelect, setClassSelect] = useState(knownClass);
  const [classCustom, setClassCustom] = useState(
    knownClass === 'Otra' ? (initial?.sailing_class ?? '') : ''
  );
  const [location, setLocation] = useState(initial?.location ?? '');
  const [startDate, setStartDate] = useState(initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(initial?.end_date ?? '');
  const [opensAt, setOpensAt] = useState(toLocalInput(initial?.registration_opens_at ?? null));
  const [closesAt, setClosesAt] = useState(toLocalInput(initial?.registration_closes_at ?? null));
  const [maxEntries, setMaxEntries] = useState(
    initial?.max_entries != null ? String(initial.max_entries) : ''
  );
  const [discards, setDiscards] = useState(String(initial?.discards_count ?? 0));
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const sailingClass = classSelect === 'Otra' ? classCustom.trim() : classSelect;
    if (!name.trim()) return setError('El nombre es obligatorio');
    if (!sailingClass) return setError('Elegí la clase');
    if (!startDate || !endDate) return setError('Las fechas son obligatorias');
    if (new Date(endDate) < new Date(startDate))
      return setError('La fecha de fin no puede ser anterior a la de inicio');

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      sailing_class: sailingClass,
      location: location.trim() || null,
      start_date: startDate,
      end_date: endDate,
      registration_opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      registration_closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      max_entries: maxEntries ? Number(maxEntries) : null,
      discards_count: Number(discards) || 0,
      photo_url: photoUrl.trim() || null,
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nombre *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campeonato Snipe 2026" />
        </Field>
        <Field label="Descripción">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        <Field label="Clase *" hint={lockClass ? 'No editable: ya hay inscriptos' : undefined}>
          <Select
            value={classSelect}
            onChange={(e) => setClassSelect(e.target.value)}
            disabled={lockClass}
          >
            <option value="">Elegí una clase…</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="Otra">Otra</option>
          </Select>
        </Field>
        {classSelect === 'Otra' && !lockClass && (
          <Input
            value={classCustom}
            onChange={(e) => setClassCustom(e.target.value)}
            placeholder="Escribe la clase"
          />
        )}
        <Field label="Ubicación">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Río de la Plata" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inicio *">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Fin *">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Apertura inscripción">
            <Input type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </Field>
          <Field label="Cierre inscripción">
            <Input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cupo (opcional)">
            <Input type="number" min={1} value={maxEntries} onChange={(e) => setMaxEntries(e.target.value)} placeholder="Sin límite" />
          </Field>
          <Field label="Descartes">
            <Input type="number" min={0} value={discards} onChange={(e) => setDiscards(e.target.value)} />
          </Field>
        </div>
        <Field label="URL de la foto (opcional)">
          <Input type="url" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://…" />
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
