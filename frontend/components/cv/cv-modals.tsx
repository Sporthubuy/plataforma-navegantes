'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import type { SailingHourEntry, CommunityAchievement } from '@/lib/types';
import { COMMUNITY_ACHIEVEMENT_LABEL, COMMUNITY_ACHIEVEMENT_ICON } from '@/lib/types';
import {
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABEL,
  type CredentialType,
  WORK_TYPES,
  WORK_TYPE_LABEL,
  type WorkType,
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

// ============================================================
// HISTORIAL LABORAL EN LA INDUSTIA NÁUTICA
// ============================================================

const MONTHS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Genera opciones de año desde 1970 hasta el año próximo. */
function yearOptions(): number[] {
  const next = new Date().getFullYear() + 1;
  const arr: number[] = [];
  for (let y = next; y >= 1970; y--) arr.push(y);
  return arr;
}

/** Alta de un cargo laboral en la industria náutica. */
export function WorkExperienceModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [workType, setWorkType] = useState<WorkType>('sailing_school');
  const [startMonth, setStartMonth] = useState(1);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [current, setCurrent] = useState(true);
  const [endMonth, setEndMonth] = useState(1);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/api/users/profile/${userId}/work`, {
        role: role.trim(),
        organization: organization.trim() || null,
        location: location.trim() || null,
        work_type: workType,
        start_month: startMonth,
        start_year: startYear,
        end_month: current ? null : endMonth,
        end_year: current ? null : endYear,
        description: description.trim() || null,
      });
      toast.success('Cargo agregado al historial laboral');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo agregar el cargo'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Agregar experiencia laboral" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Cargo / puesto *" hint="Ej: Profesor de vela, Táctico, Manager, Constructor…">
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Profesor de vela"
            required
            maxLength={150}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Organización" hint="Club, federación, escuela, yarda…">
            <Input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Club Neptuno"
              maxLength={150}
            />
          </Field>
          <Field label="Ubicación">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Punta del Este, UY"
              maxLength={150}
            />
          </Field>
        </div>

        <Field label="Tipo de trabajo">
          <Select
            value={workType}
            onChange={(e) => setWorkType(e.target.value as WorkType)}
          >
            {WORK_TYPES.map((t) => (
              <option key={t} value={t}>
                {WORK_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset className="border-t border-navy-100 pt-4">
          <legend className="text-sm font-bold text-navy-900">Fecha de inicio</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="Mes">
              <Select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
              >
                {MONTHS_FULL.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Año">
              <Select
                value={startYear}
                onChange={(e) => setStartYear(Number(e.target.value))}
              >
                {yearOptions().map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm font-medium text-navy-800">
          <input
            type="checkbox"
            checked={current}
            onChange={(e) => setCurrent(e.target.checked)}
            className="h-4 w-4 accent-navy-700"
          />
          Actualmente ocupo este cargo
        </label>

        {!current && (
          <fieldset className="border-t border-navy-100 pt-4">
            <legend className="text-sm font-bold text-navy-900">Fecha de fin</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="Mes">
                <Select
                  value={endMonth}
                  onChange={(e) => setEndMonth(Number(e.target.value))}
                >
                  {MONTHS_FULL.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Año">
                <Select
                  value={endYear}
                  onChange={(e) => setEndYear(Number(e.target.value))}
                >
                  {yearOptions().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </fieldset>
        )}

        <Field label="Descripción" hint="Responsabilidades, logros, equipos a cargo…">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="A cargo de la escuela infantil. Preparación de 15 alumnos para el Campeonato Nacional 2024…"
          />
        </Field>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Agregar cargo'}
        </Button>
      </form>
    </Modal>
  );
}

// ============================================================
// HORAS DE MAR
// ============================================================

/** Alta de una salida de navegación. */
export function SailingHoursModal({
  userId,
  onClose,
  onSaved,
}: {
  userId: string;
  onClose: () => void;
  onSaved: (entry: SailingHourEntry) => void;
}) {
  const [sailedDate, setSailedDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [sailingClass, setSailingClass] = useState('');
  const [crewMates, setCrewMates] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedHours = parseFloat(hours);
    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 24) {
      toast.error('Las horas deben estar entre 0 y 24');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/api/users/profile/${userId}/sailing-hours`, {
        sailed_date: sailedDate,
        hours: parsedHours,
        sailing_class: sailingClass.trim() || null,
        crew_mates: crewMates.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success('Salida registrada');
      onSaved(res.data.sailing_hours);
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo registrar la salida'));
      setSaving(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal title="Registrar salida" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
          Registrá tus horas de navegación. Esto suma para tu rango y
          racha de actividad en la comunidad.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha *">
            <Input
              type="date"
              value={sailedDate}
              max={today}
              onChange={(e) => setSailedDate(e.target.value)}
              required
            />
          </Field>
          <Field label="Horas *">
            <Input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              inputMode="decimal"
              placeholder="3.5"
              required
            />
          </Field>
        </div>

        <Field label="Clase / barco">
          <Select
            value={sailingClass}
            onChange={(e) => setSailingClass(e.target.value)}
          >
            <option value="">Sin especificar</option>
            {BOAT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </Field>

        <Field label="Tripulantes">
          <Input
            value={crewMates}
            onChange={(e) => setCrewMates(e.target.value)}
            placeholder="Juan, María, Pedro"
            maxLength={500}
          />
        </Field>

        <Field label="Notas">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Condiciones, salida, tipo de navegación…"
          />
        </Field>

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Registrar salida'}
        </Button>
      </form>
    </Modal>
  );
}

/** Tarjetas de logros comunitarios. */
export function CommunityAchievementBadges({
  achievements,
}: {
  achievements: CommunityAchievement[];
}) {
  if (achievements.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {achievements.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700"
          title={a.description ?? COMMUNITY_ACHIEVEMENT_LABEL[a.achievement_type]}
        >
          <span>{COMMUNITY_ACHIEVEMENT_ICON[a.achievement_type]}</span>
          {COMMUNITY_ACHIEVEMENT_LABEL[a.achievement_type]}
        </span>
      ))}
    </div>
  );
}
