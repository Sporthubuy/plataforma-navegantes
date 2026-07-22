'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { HULL_MATERIALS, RATING_SYSTEMS, type Boat } from '@/lib/types';

/**
 * Clases de vela. Es el dato que decide si un barco puede inscribirse
 * a una clase de regata, así que conviene que el listado sea amplio.
 * 'Otra' va siempre última: varias pantallas la filtran por nombre.
 */
export const BOAT_CATEGORIES = [
  'Optimist',
  'ILCA / Laser',
  '420',
  '470',
  '29er',
  '49er',
  'Snipe',
  'Cadet',
  'Lightning',
  'Finn',
  'Europa',
  'Star',
  'Soling',
  'Grumete',
  'Vaurien',
  'Nacra 17',
  'Hobie Cat 16',
  'J/24',
  'J/70',
  'Soto 40',
  'Crucero',
  'Windsurf',
  'Kite',
  'Otra',
];

export interface BoatFormData {
  name: string;
  sail_number: string | null;
  category: string;
  builder: string | null;
  model: string | null;
  designer: string | null;
  year_built: number | null;
  hull_material: string | null;
  registration_number: string | null;
  home_port: string | null;
  flag: string | null;
  rating_system: string | null;
  rating_value: number | null;
  crew_capacity: number | null;
}

/** Devuelve el texto recortado o null si quedó vacío. */
function orNull(value: string): string | null {
  return value.trim() || null;
}

export function BoatForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial?: Boat;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (data: BoatFormData, photo: File | null) => void;
}) {
  const knownCategory =
    initial && BOAT_CATEGORIES.includes(initial.category)
      ? initial.category
      : initial
        ? 'Otra'
        : '';

  const [name, setName] = useState(initial?.name ?? '');
  const [sailNumber, setSailNumber] = useState(initial?.sail_number ?? '');
  const [category, setCategory] = useState(knownCategory);
  const [customCategory, setCustomCategory] = useState(
    knownCategory === 'Otra' ? (initial?.category ?? '') : ''
  );

  // Ficha ampliada — opcional, plegada salvo que el barco ya tenga datos.
  const [builder, setBuilder] = useState(initial?.builder ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [designer, setDesigner] = useState(initial?.designer ?? '');
  const [yearBuilt, setYearBuilt] = useState(
    initial?.year_built ? String(initial.year_built) : ''
  );
  const [hullMaterial, setHullMaterial] = useState(initial?.hull_material ?? '');
  const [registration, setRegistration] = useState(
    initial?.registration_number ?? ''
  );
  const [homePort, setHomePort] = useState(initial?.home_port ?? '');
  const [flag, setFlag] = useState(initial?.flag ?? '');
  const [ratingSystem, setRatingSystem] = useState(initial?.rating_system ?? '');
  const [ratingValue, setRatingValue] = useState(
    initial?.rating_value != null ? String(initial.rating_value) : ''
  );
  const [crewCapacity, setCrewCapacity] = useState(
    initial?.crew_capacity != null ? String(initial.crew_capacity) : ''
  );

  const hasDetails = Boolean(
    initial &&
      (initial.builder ||
        initial.model ||
        initial.designer ||
        initial.year_built ||
        initial.hull_material ||
        initial.registration_number ||
        initial.home_port ||
        initial.flag ||
        initial.rating_system ||
        initial.crew_capacity)
  );
  const [detailsOpen, setDetailsOpen] = useState(hasDetails);

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    initial?.photo_url ?? null
  );
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(file: File | null) {
    setPhoto(file);
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const finalCategory =
      category === 'Otra' ? customCategory.trim() : category;

    if (!name.trim()) {
      setError('El nombre del barco es obligatorio');
      return;
    }
    if (!finalCategory) {
      setError('Elige o escribe la clase del barco');
      return;
    }

    const maxYear = new Date().getFullYear() + 2;
    const year = yearBuilt.trim() ? Number(yearBuilt) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1800 || year > maxYear)) {
      setError(`El año debe estar entre 1800 y ${maxYear}`);
      return;
    }

    const crew = crewCapacity.trim() ? Number(crewCapacity) : null;
    if (crew !== null && (!Number.isInteger(crew) || crew < 1 || crew > 50)) {
      setError('La tripulación debe ser un número entre 1 y 50');
      return;
    }

    const rating = ratingValue.trim() ? Number(ratingValue) : null;
    if (rating !== null && !Number.isFinite(rating)) {
      setError('El rating debe ser un número');
      return;
    }
    if (rating !== null && !ratingSystem) {
      setError('Elegí el sistema de rating antes de cargar el valor');
      return;
    }

    const normalizedFlag = flag.trim().toUpperCase();
    if (normalizedFlag && !/^[A-Z]{2}$/.test(normalizedFlag)) {
      setError('La bandera debe ser un código de país de 2 letras (ej: UY)');
      return;
    }

    onSubmit(
      {
        name: name.trim(),
        sail_number: orNull(sailNumber),
        category: finalCategory,
        builder: orNull(builder),
        model: orNull(model),
        designer: orNull(designer),
        year_built: year,
        hull_material: orNull(hullMaterial),
        registration_number: orNull(registration),
        home_port: orNull(homePort),
        flag: normalizedFlag || null,
        rating_system: orNull(ratingSystem),
        // Sin sistema el valor no significa nada.
        rating_value: ratingSystem ? rating : null,
        crew_capacity: crew,
      },
      photo
    );
  }

  const inputClass =
    'rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200';
  const labelClass = 'flex flex-col gap-1 text-sm font-medium text-navy-800';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
    >
      {/* Foto */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-navy-200 bg-navy-50 text-navy-400 hover:border-navy-400"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm">
            <span className="text-3xl">⛵</span>
            Tocar para agregar foto
          </span>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
      />

      <label className={labelClass}>
        Nombre del barco *
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Albatros"
        />
      </label>

      <label className={labelClass}>
        Número de vela
        <input
          value={sailNumber}
          onChange={(e) => setSailNumber(e.target.value)}
          className={inputClass}
          placeholder="URU 123"
        />
      </label>

      <label className={labelClass}>
        Clase *
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} bg-white`}
        >
          <option value="" disabled>
            Elige una clase…
          </option>
          {BOAT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-navy-400">
          Es la que define en qué clases de regata podés inscribirte.
        </span>
      </label>

      {category === 'Otra' && (
        <label className={labelClass}>
          ¿Cuál?
          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className={inputClass}
            placeholder="Escribe la clase del barco"
          />
        </label>
      )}

      {/* Ficha ampliada: todo opcional, plegada por defecto. */}
      <button
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        aria-expanded={detailsOpen}
        className="focus-ring -mx-1 flex items-center justify-between rounded-lg px-1 py-2 text-left text-sm font-semibold text-navy-700 hover:text-water-600"
      >
        Más datos del barco (opcional)
        <ChevronDown
          className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {detailsOpen && (
        <div className="flex flex-col gap-4 border-t border-navy-100 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-400">
            Construcción
          </p>

          <label className={labelClass}>
            Astillero
            <input
              value={builder}
              onChange={(e) => setBuilder(e.target.value)}
              className={inputClass}
              placeholder="Astillero Persico"
            />
          </label>

          <label className={labelClass}>
            Modelo o proyecto
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
              placeholder="Beneteau First 36.7"
            />
          </label>

          <label className={labelClass}>
            Diseñador
            <input
              value={designer}
              onChange={(e) => setDesigner(e.target.value)}
              className={inputClass}
              placeholder="Bruce Farr"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Año
              <input
                value={yearBuilt}
                onChange={(e) => setYearBuilt(e.target.value)}
                className={inputClass}
                inputMode="numeric"
                placeholder="2014"
              />
            </label>

            <label className={labelClass}>
              Material del casco
              <select
                value={hullMaterial}
                onChange={(e) => setHullMaterial(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Sin especificar</option>
                {HULL_MATERIALS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-navy-400">
            Registro y amarra
          </p>

          <label className={labelClass}>
            Matrícula
            <input
              value={registration}
              onChange={(e) => setRegistration(e.target.value)}
              className={inputClass}
              placeholder="Número de registro"
            />
          </label>

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className={labelClass}>
              Puerto base
              <input
                value={homePort}
                onChange={(e) => setHomePort(e.target.value)}
                className={inputClass}
                placeholder="Puerto del Buceo"
              />
            </label>

            <label className={labelClass}>
              Bandera
              <input
                value={flag}
                onChange={(e) => setFlag(e.target.value.toUpperCase())}
                className={inputClass}
                maxLength={2}
                placeholder="UY"
              />
            </label>
          </div>

          <p className="mt-2 text-xs font-bold uppercase tracking-wider text-navy-400">
            Regata
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Sistema de rating
              <select
                value={ratingSystem}
                onChange={(e) => setRatingSystem(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Sin rating</option>
                {RATING_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Valor del certificado
              <input
                value={ratingValue}
                onChange={(e) => setRatingValue(e.target.value)}
                className={inputClass}
                inputMode="decimal"
                disabled={!ratingSystem}
                placeholder={ratingSystem ? '1.045' : 'Elegí el sistema'}
              />
            </label>
          </div>

          <label className={labelClass}>
            Tripulación (personas a bordo)
            <input
              value={crewCapacity}
              onChange={(e) => setCrewCapacity(e.target.value)}
              className={inputClass}
              inputMode="numeric"
              placeholder="5"
            />
          </label>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 rounded-lg bg-navy-800 py-2.5 font-semibold text-white transition hover:bg-navy-700 disabled:opacity-60"
      >
        {submitting ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
