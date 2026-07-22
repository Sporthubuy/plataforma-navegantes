import type { Boat } from '@/lib/types';

/** Convierte un ISO 3166-1 alfa-2 en su emoji de bandera. */
function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/**
 * Ficha técnica del barco. Muestra solo los campos cargados, así que
 * un barco sin datos extra no ocupa espacio en la pantalla.
 */
export function BoatSpecs({ boat }: { boat: Boat }) {
  const specs: { label: string; value: string }[] = [];

  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    specs.push({ label, value: String(value) });
  };

  add('Astillero', boat.builder);
  add('Modelo', boat.model);
  add('Diseñador', boat.designer);
  add('Año', boat.year_built);
  add('Casco', boat.hull_material);
  add('Matrícula', boat.registration_number);
  add('Club', boat.club ? boat.club.name : null);
  add('Ciudad', boat.club?.city ?? null);
  if (boat.flag) {
    add('Bandera', `${flagEmoji(boat.flag)} ${boat.flag}`.trim());
  }
  if (boat.rating_system) {
    add(
      'Rating',
      boat.rating_value != null
        ? `${boat.rating_system} ${boat.rating_value}`
        : boat.rating_system
    );
  }
  add(
    'Tripulación',
    boat.crew_capacity != null
      ? `${boat.crew_capacity} ${boat.crew_capacity === 1 ? 'persona' : 'personas'}`
      : null
  );

  if (specs.length === 0) return null;

  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-navy-100 pt-4">
      {specs.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold tracking-wide text-navy-400 uppercase">
            {label}
          </dt>
          {/* La tarjeta es angosta: mejor que el texto baje de línea
              a que se corte con puntos suspensivos. */}
          <dd className="text-sm font-medium break-words text-navy-800">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
