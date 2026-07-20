'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { Boat } from '@/lib/types';

export const BOAT_CATEGORIES = [
  'Optimist',
  'ILCA / Laser',
  '420',
  '29er',
  'Snipe',
  'J/24',
  'J/70',
  'Soto 40',
  'Crucero',
  'Otra',
];

export interface BoatFormData {
  name: string;
  sail_number: string | null;
  category: string;
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
      setError('Elige o escribe la categoría del barco');
      return;
    }

    onSubmit(
      {
        name: name.trim(),
        sail_number: sailNumber.trim() || null,
        category: finalCategory,
      },
      photo
    );
  }

  const inputClass =
    'rounded-lg border border-navy-200 px-3 py-2.5 text-base outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-200';

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

      <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
        Nombre del barco *
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="Albatros"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
        Número de vela
        <input
          value={sailNumber}
          onChange={(e) => setSailNumber(e.target.value)}
          className={inputClass}
          placeholder="URU 123"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
        Categoría *
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} bg-white`}
        >
          <option value="" disabled>
            Elige una categoría…
          </option>
          {BOAT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {category === 'Otra' && (
        <label className="flex flex-col gap-1 text-sm font-medium text-navy-800">
          ¿Cuál?
          <input
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className={inputClass}
            placeholder="Escribe la clase del barco"
          />
        </label>
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
