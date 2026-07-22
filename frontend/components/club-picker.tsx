'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Field, Select } from '@/components/ui/input';
import { countryName } from '@/lib/geo';
import type { Club } from '@/lib/types';

/**
 * Selector de club sobre el catálogo precargado. Los clubes los
 * administra quien tenga el permiso `clubs.manage`; acá solo se eligen.
 *
 * Si se pasa `country`, filtra por ese país; si no, trae todos y los
 * agrupa por país para que la lista no sea un chorizo.
 */
export function ClubPicker({
  value,
  onChange,
  label = 'Club',
  hint,
  country,
}: {
  value: string | null;
  onChange: (clubId: string | null) => void;
  label?: string;
  hint?: string;
  country?: string | null;
}) {
  const [clubs, setClubs] = useState<Club[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/api/clubs', { params: country ? { country } : {} })
      .then((res) => {
        if (!cancelled) setClubs(res.data.clubs);
      })
      .catch(() => {
        if (!cancelled) setClubs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  // Agrupado por país solo cuando hay más de uno en juego.
  const byCountry = new Map<string, Club[]>();
  for (const club of clubs ?? []) {
    const list = byCountry.get(club.country) ?? [];
    list.push(club);
    byCountry.set(club.country, list);
  }
  const grouped = byCountry.size > 1;

  const option = (club: Club) => (
    <option key={club.id} value={club.id}>
      {club.name}
      {club.city ? ` · ${club.city}` : ''}
    </option>
  );

  return (
    <Field label={label} hint={hint}>
      <Select
        value={value ?? ''}
        disabled={clubs === null}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">
          {clubs === null ? 'Cargando clubes…' : 'Sin club'}
        </option>
        {grouped
          ? [...byCountry.entries()].map(([code, list]) => (
              <optgroup key={code} label={countryName(code)}>
                {list.map(option)}
              </optgroup>
            ))
          : (clubs ?? []).map(option)}
      </Select>
      {clubs?.length === 0 && (
        <span className="text-xs font-normal text-navy-400">
          Todavía no hay clubes cargados{country ? ' en ese país' : ''}.
        </span>
      )}
    </Field>
  );
}
