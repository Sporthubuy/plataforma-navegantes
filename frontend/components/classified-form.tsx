'use client';

import { useState } from 'react';
import type {
  Classified,
  ClassifiedCategory,
  ClassifiedRequirementType,
} from '@/lib/types';
import { Button } from '@/components/ui/button';

export interface ClassifiedFormData {
  category: ClassifiedCategory;
  title: string;
  description: string;
  location: string;
  location_worldwide: boolean;
  contact_email: string;
  contact_phone: string;
  requirements: Array<{
    requirement_type: ClassifiedRequirementType;
    requirement_value: string;
  }>;
}

const LOCATION_SUGGESTIONS = [
  'Río de la Plata, Uruguay',
  'Montevideo',
  'Mar del Plata',
  'Buenos Aires',
  'Punta del Este',
];

const REQUIREMENT_TYPES: Array<{ value: ClassifiedRequirementType; label: string }> = [
  { value: 'sailing_class', label: 'Clase de vela' },
  { value: 'experience_level', label: 'Nivel de experiencia' },
  { value: 'role', label: 'Rol a bordo' },
  { value: 'language', label: 'Idioma' },
  { value: 'availability', label: 'Disponibilidad' },
];

const SAILING_CLASSES = ['ILCA', 'Optimist', 'Snipe', 'J/24', 'Crucero', 'Laser'];
const EXPERIENCE_LEVELS = ['Principiante', 'Intermedio', 'Avanzado'];
const ROLES = ['Timonel', 'Proa', 'Táctico', 'Trimmer', 'Tripulante'];
const AVAILABILITIES = ['Fines de semana', 'Entre semana', 'Regatas puntuales', 'Temporada completa'];

const inputClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-navy-500 focus:ring-2 focus:ring-navy-100';

function valueOptions(type: ClassifiedRequirementType): string[] | null {
  if (type === 'sailing_class') return SAILING_CLASSES;
  if (type === 'experience_level') return EXPERIENCE_LEVELS;
  if (type === 'role') return ROLES;
  if (type === 'availability') return AVAILABILITIES;
  return null;
}

function initialRequirements(classified?: Classified): ClassifiedFormData['requirements'] {
  return (classified?.requirements ?? []).map(({ requirement_type, requirement_value }) => ({
    requirement_type,
    requirement_value,
  }));
}

export function ClassifiedForm({
  classified,
  defaultEmail = '',
  submitting,
  submitLabel,
  onSubmit,
}: {
  classified?: Classified;
  defaultEmail?: string;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (data: ClassifiedFormData) => Promise<void>;
}) {
  const [category, setCategory] = useState<ClassifiedCategory>(classified?.category ?? 'tripulante');
  const [title, setTitle] = useState(classified?.title ?? '');
  const [description, setDescription] = useState(classified?.description ?? '');
  const [location, setLocation] = useState(classified?.location ?? '');
  const [worldwide, setWorldwide] = useState(classified?.location_worldwide ?? false);
  const [contactEmail, setContactEmail] = useState(classified?.contact_email ?? defaultEmail);
  const [contactPhone, setContactPhone] = useState(classified?.contact_phone ?? '');
  const [requirements, setRequirements] = useState<ClassifiedFormData['requirements']>(initialRequirements(classified));
  const [requirementType, setRequirementType] = useState<ClassifiedRequirementType>('sailing_class');
  const [requirementValue, setRequirementValue] = useState('');

  function addRequirement() {
    const value = requirementValue.trim();
    if (!value || requirements.some((item) => item.requirement_type === requirementType && item.requirement_value.toLowerCase() === value.toLowerCase())) return;
    setRequirements((current) => [...current, { requirement_type: requirementType, requirement_value: value }]);
    setRequirementValue('');
  }

  function removeRequirement(index: number) {
    setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      category,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      location_worldwide: worldwide,
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      requirements,
    });
  }

  const options = valueOptions(requirementType);
  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm md:p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-navy-800">
            Categoría
            <select value={category} onChange={(event) => setCategory(event.target.value as ClassifiedCategory)} className={`${inputClass} mt-2`}>
              <option value="tripulante">Tripulante</option>
              <option value="profesor">Profesor</option>
              <option value="barco">Barco</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-navy-800">
            Ubicación
            <input required list="classified-locations" value={location} onChange={(event) => setLocation(event.target.value)} className={`${inputClass} mt-2`} placeholder="Montevideo" />
            <datalist id="classified-locations">{LOCATION_SUGGESTIONS.map((item) => <option key={item} value={item} />)}</datalist>
          </label>
        </div>
        <label className="mt-4 block text-sm font-semibold text-navy-800">
          Título
          <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-2`} placeholder="Busco Proa para regata ILCA" />
        </label>
        <label className="mt-4 block text-sm font-semibold text-navy-800">
          Descripción
          <textarea required rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} mt-2 resize-y`} placeholder="Contá qué estás buscando y qué ofrecés..." />
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm font-medium text-navy-700">
          <input type="checkbox" checked={worldwide} onChange={(event) => setWorldwide(event.target.checked)} className="mt-0.5 h-4 w-4 accent-navy-700" />
          <span><strong className="text-navy-900">¿A nivel mundial?</strong><span className="block text-xs font-normal text-navy-500">Ignora la ubicación al calcular matches.</span></span>
        </label>
      </section>

      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Matching</p><h2 className="mt-1 text-lg font-bold text-navy-900">¿Qué buscas?</h2></div>
          <span className="text-xs text-navy-400">{requirements.length} requisito{requirements.length === 1 ? '' : 's'}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-navy-800">Tipo<select value={requirementType} onChange={(event) => { setRequirementType(event.target.value as ClassifiedRequirementType); setRequirementValue(''); }} className={`${inputClass} mt-2`}>{REQUIREMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="text-sm font-semibold text-navy-800">Valor{options ? <select value={requirementValue} onChange={(event) => setRequirementValue(event.target.value)} className={`${inputClass} mt-2`}><option value="">Elegir...</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input value={requirementValue} onChange={(event) => setRequirementValue(event.target.value)} className={`${inputClass} mt-2`} placeholder="Ej: portugués" />}</label>
          <Button type="button" variant="secondary" size="sm" onClick={addRequirement}>+ Agregar</Button>
        </div>
        {requirements.length > 0 && <ul className="mt-4 space-y-2">{requirements.map((requirement, index) => <li key={`${requirement.requirement_type}-${requirement.requirement_value}`} className="flex items-center justify-between gap-3 rounded-xl bg-navy-50 px-3 py-2 text-sm text-navy-700"><span><strong>{REQUIREMENT_TYPES.find((item) => item.value === requirement.requirement_type)?.label}:</strong> {requirement.requirement_value}</span><button type="button" onClick={() => removeRequirement(index)} className="px-2 text-lg text-navy-400 hover:text-red-600" aria-label="Quitar requisito">×</button></li>)}</ul>}
      </section>

      <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Contacto</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-navy-800">Email<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={`${inputClass} mt-2`} placeholder="tu@email.com" /></label>
          <label className="text-sm font-semibold text-navy-800">Teléfono <span className="font-normal text-navy-400">(opcional)</span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={`${inputClass} mt-2`} placeholder="+598..." /></label>
        </div>
      </section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="submit" disabled={submitting}>{submitting ? 'Guardando...' : submitLabel}</Button></div>
    </form>
  );
}