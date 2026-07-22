'use client';

import { useId } from 'react';
import { Field, Input, Select } from '@/components/ui/input';
import {
  COUNTRIES,
  citiesByRegion,
  hasCities,
  DEFAULT_COUNTRY,
} from '@/lib/geo';

export interface LocationValue {
  country: string | null;
  city: string | null;
}

/**
 * Selector de país → ciudad. La ciudad queda deshabilitada hasta que
 * hay país elegido, y cambiar de país la limpia (una ciudad de otro
 * país no significa nada).
 *
 * Para los países con localidades precargadas se muestra un desplegable
 * agrupado por región; para el resto, un campo de texto libre.
 */
export function LocationPicker({
  value,
  onChange,
  countryLabel = 'País',
  cityLabel = 'Ciudad',
  hint,
  required = false,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  countryLabel?: string;
  cityLabel?: string;
  hint?: string;
  required?: boolean;
}) {
  const id = useId();
  const country = value.country ?? '';
  const regions = country ? citiesByRegion(country) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        label={required ? `${countryLabel} *` : countryLabel}
        htmlFor={`${id}-country`}
      >
        <Select
          id={`${id}-country`}
          value={country}
          onChange={(e) =>
            // Al cambiar de país la ciudad anterior deja de aplicar.
            onChange({ country: e.target.value || null, city: null })
          }
        >
          <option value="">Sin especificar</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={cityLabel} htmlFor={`${id}-city`} hint={hint}>
        {regions ? (
          <Select
            id={`${id}-city`}
            value={value.city ?? ''}
            disabled={!country}
            onChange={(e) =>
              onChange({ country: country || null, city: e.target.value || null })
            }
          >
            <option value="">
              {country ? 'Todo el país' : 'Elegí el país primero'}
            </option>
            {Object.entries(regions).map(([region, cities]) => (
              <optgroup key={region} label={region}>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        ) : (
          <Input
            id={`${id}-city`}
            value={value.city ?? ''}
            disabled={!country}
            placeholder={
              country ? 'Escribí la ciudad' : 'Elegí el país primero'
            }
            onChange={(e) =>
              onChange({ country: country || null, city: e.target.value || null })
            }
          />
        )}
      </Field>
    </div>
  );
}

/** ¿El país tiene lista de ciudades? Reexportado por comodidad. */
export { hasCities, DEFAULT_COUNTRY };
