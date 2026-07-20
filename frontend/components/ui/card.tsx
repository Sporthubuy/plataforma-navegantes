import type { HTMLAttributes } from 'react';

/** Superficie blanca redondeada, unidad visual base de la app. */
export function Card({
  className = '',
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={`rounded-2xl bg-white shadow-sm ${padded ? 'p-4 md:p-6' : ''} ${className}`}
      {...props}
    />
  );
}
