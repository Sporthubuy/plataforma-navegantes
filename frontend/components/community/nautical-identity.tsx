'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Anchor, Plus, Sailboat, Trash2 } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ClubPicker } from '@/components/club-picker';
import { BOAT_CATEGORIES } from '@/components/boat-form';

/** Roles a bordo más habituales. 'Otro' deja escribirlo a mano. */
const CREW_ROLES = [
  'Timonel',
  'Proa',
  'Táctico',
  'Trimmer',
  'Piano',
  'Navegante',
  'Otro',
];

export interface SailingInterest {
  id: string;
  sailing_class: string;
  role: string | null;
}

export interface NauticalPosition {
  id: string;
  title: string;
  club_id: string | null;
  organization: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  club?: { id: string; name: string; short_name: string | null } | null;
}

/** "Proa en J/24" o "Windsurf" si no hay rol. */
function interestLabel(interest: SailingInterest): string {
  return interest.role
    ? `${interest.role} en ${interest.sailing_class}`
    : interest.sailing_class;
}

function positionPeriod(position: NauticalPosition): string {
  const year = (iso: string | null) => (iso ? iso.slice(0, 4) : '');
  const from = year(position.start_date);
  if (position.is_current) return from ? `Desde ${from}` : 'En curso';
  const to = year(position.end_date);
  if (from && to) return `${from} – ${to}`;
  return from || to || '';
}

function InterestModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sailingClass, setSailingClass] = useState('');
  const [customClass, setCustomClass] = useState('');
  const [role, setRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const finalClass =
      sailingClass === 'Otra' ? customClass.trim() : sailingClass;
    if (!finalClass) {
      toast.error('Elegí una clase');
      return;
    }
    const finalRole = role === 'Otro' ? customRole.trim() : role;

    setSaving(true);
    try {
      await api.post(`/api/community/${userId}/interests`, {
        sailing_class: finalClass,
        role: finalRole || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar'));
      setSaving(false);
    }
  }

  return (
    <Modal title="¿En qué te gusta navegar?" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Clase *">
          <Select
            value={sailingClass}
            onChange={(e) => setSailingClass(e.target.value)}
          >
            <option value="">Elegí una clase…</option>
            {BOAT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        {sailingClass === 'Otra' && (
          <Field label="¿Cuál?">
            <Input
              value={customClass}
              onChange={(e) => setCustomClass(e.target.value)}
              placeholder="Kitefoil, Vaurien…"
            />
          </Field>
        )}

        <Field
          label="Rol a bordo"
          hint="Opcional. En tablas y solitarios no aplica."
        >
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Sin rol específico</option>
            {CREW_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>

        {role === 'Otro' && (
          <Field label="¿Cuál?">
            <Input
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="Escribí el rol"
            />
          </Field>
        )}

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Agregar'}
        </Button>
      </form>
    </Modal>
  );
}

function PositionModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [clubId, setClubId] = useState<string | null>(null);
  const [organization, setOrganization] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Escribí el cargo');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/community/${userId}/positions`, {
        title: title.trim(),
        club_id: clubId,
        organization: organization.trim() || null,
        start_date: startDate || null,
        end_date: isCurrent ? null : endDate || null,
        is_current: isCurrent,
      });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar el cargo'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Agregar cargo náutico" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Cargo *" hint="Comodoro, Entrenador, Capitán de flota…">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="Comodoro"
            required
          />
        </Field>

        <ClubPicker
          value={clubId}
          onChange={setClubId}
          label="Club o federación"
          hint="Si no está en la lista, escribilo abajo."
        />

        {!clubId && (
          <Field label="Otra institución">
            <Input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              maxLength={150}
              placeholder="Federación Uruguaya de Vela"
            />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Desde">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              value={endDate}
              disabled={isCurrent}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-navy-700">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="h-4 w-4 accent-navy-700"
          />
          Es mi cargo actual
        </label>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Agregar cargo'}
        </Button>
      </form>
    </Modal>
  );
}

/**
 * Identidad náutica: en qué le gusta navegar y qué cargos ocupa.
 *
 * Va junto en una sección porque responden a la misma pregunta —quién es
 * esta persona en el agua— y por separado del legajo profesional.
 */
export function NauticalIdentity({
  userId,
  isOwner,
}: {
  userId: string;
  isOwner: boolean;
}) {
  const [interests, setInterests] = useState<SailingInterest[]>([]);
  const [positions, setPositions] = useState<NauticalPosition[]>([]);
  const [interestModal, setInterestModal] = useState(false);
  const [positionModal, setPositionModal] = useState(false);

  const load = useCallback(() => {
    api
      .get(`/api/community/${userId}/interests`)
      .then((res) => setInterests(res.data.interests))
      .catch(() => setInterests([]));
    api
      .get(`/api/community/${userId}/positions`)
      .then((res) => setPositions(res.data.positions))
      .catch(() => setPositions([]));
  }, [userId]);

  useEffect(load, [load]);

  async function removeInterest(id: string) {
    try {
      await api.delete(`/api/community/${userId}/interests/${id}`);
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  async function removePosition(id: string) {
    if (!confirm('¿Borrar este cargo?')) return;
    try {
      await api.delete(`/api/community/${userId}/positions/${id}`);
      load();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  // Un perfil ajeno sin nada cargado no muestra secciones vacías.
  if (!isOwner && interests.length === 0 && positions.length === 0) return null;

  const addButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-water-600 hover:bg-water-50"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
            <Sailboat className="h-5 w-5 text-water-600" />
            Navego en
          </h2>
          {isOwner && addButton('Agregar', () => setInterestModal(true))}
        </div>

        {interests.length === 0 ? (
          <p className="text-sm text-navy-400">
            Contá en qué te gusta navegar: windsurf, Optimist, proa en J/24…
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <li
                key={interest.id}
                className="flex items-center gap-1.5 rounded-full border border-navy-100 bg-white px-3 py-1.5 text-sm font-medium text-navy-700"
              >
                {interestLabel(interest)}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => removeInterest(interest.id)}
                    aria-label={`Quitar ${interestLabel(interest)}`}
                    className="focus-ring rounded text-navy-300 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-navy-900">
            <Anchor className="h-5 w-5 text-water-600" />
            Cargos náuticos
          </h2>
          {isOwner && addButton('Agregar cargo', () => setPositionModal(true))}
        </div>

        {positions.length === 0 ? (
          <p className="text-sm text-navy-400">
            {isOwner
              ? 'Si tenés un cargo en un club o federación, agregalo acá.'
              : 'Sin cargos cargados.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {positions.map((position) => {
              const where = position.club?.name ?? position.organization;
              const period = positionPeriod(position);
              return (
                <li
                  key={position.id}
                  className="flex items-start gap-3 rounded-xl border border-navy-100 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-navy-900">
                      {position.title}
                      {position.is_current && (
                        <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700">
                          Actual
                        </span>
                      )}
                    </p>
                    {where && <p className="text-sm text-navy-500">{where}</p>}
                    {period && <p className="text-xs text-navy-400">{period}</p>}
                  </div>

                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => removePosition(position.id)}
                      aria-label={`Borrar ${position.title}`}
                      className="focus-ring rounded-lg p-1.5 text-navy-300 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {interestModal && (
        <InterestModal
          userId={userId}
          onClose={() => setInterestModal(false)}
          onSaved={load}
        />
      )}
      {positionModal && (
        <PositionModal
          userId={userId}
          onClose={() => setPositionModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
