'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import {
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABEL,
  type CredentialType,
} from '@/lib/types';

/** Alta de una credencial. La verificación la hace un admin aparte. */
export function CredentialModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<CredentialType>('instructor');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/users/profile/${userId}/credentials`, {
        credential_type: type,
        title: title.trim(),
        issuer: issuer.trim() || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        credential_url: url.trim() || null,
      });
      toast.success('Título agregado');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar el título'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Agregar título o certificación" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Tipo *">
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as CredentialType)}
          >
            {CREDENTIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {CREDENTIAL_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Título *">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Instructor Clase ILCA"
            required
            maxLength={150}
          />
        </Field>

        <Field label="Emitido por">
          <Input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="Federación Uruguaya de Vela"
            maxLength={150}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha de emisión">
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </Field>
          <Field label="Vencimiento" hint="Vacío si no vence.">
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Link al certificado">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>

        <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
          El sello de verificado lo otorga un administrador: no podés
          verificar tus propios títulos.
        </p>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Agregar título'}
        </Button>
      </form>
    </Modal>
  );
}

const ACHIEVEMENT_OPTIONS = [
  { value: '1st_place', label: '1er puesto' },
  { value: '2nd_place', label: '2º puesto' },
  { value: '3rd_place', label: '3er puesto' },
  { value: 'podium', label: 'Podio' },
  { value: 'regatta_finished', label: 'Participación' },
];

/** Alta de un logro histórico, anterior a la plataforma. */
export function ManualAchievementModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState('1st_place');
  const [name, setName] = useState('');
  const [sailingClass, setSailingClass] = useState('');
  const [date, setDate] = useState('');
  const [position, setPosition] = useState('');
  const [totalEntries, setTotalEntries] = useState('');
  const [boatName, setBoatName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/users/profile/${userId}/achievements/manual`, {
        achievement_type: type,
        regatta_name: name.trim(),
        regatta_class: sailingClass || null,
        regatta_date: date,
        position: position || null,
        total_entries: totalEntries || null,
        boat_name: boatName.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success('Logro agregado al historial');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar el logro'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Agregar logro histórico" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
          Para regatas anteriores a la plataforma. Van a figurar como
          <strong> declarados</strong>: los resultados cargados en la app se
          muestran como verificados.
        </p>

        <Field label="Nombre de la regata *">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campeonato Nacional Snipe 2022"
            required
            maxLength={200}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Clase">
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
          <Field label="Fecha *">
            <Input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Resultado *">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {ACHIEVEMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Puesto">
            <Input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              inputMode="numeric"
              placeholder="1"
            />
          </Field>
          <Field label="Inscriptos">
            <Input
              value={totalEntries}
              onChange={(e) => setTotalEntries(e.target.value)}
              inputMode="numeric"
              placeholder="24"
            />
          </Field>
        </div>

        <Field label="Barco">
          <Input
            value={boatName}
            onChange={(e) => setBoatName(e.target.value)}
            placeholder="Tempestad"
            maxLength={100}
          />
        </Field>

        <Field label="Notas">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Algo que quieras destacar de esa regata…"
          />
        </Field>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Agregar al historial'}
        </Button>
      </form>
    </Modal>
  );
}
