import type { HTMLAttributes } from 'react';

export function Card({
  className = '',
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-navy-100 bg-white transition duration-150 hover:border-navy-200 ${padded ? 'p-4 md:p-6' : ''} ${className}`}
      {...props}
    />
  );
}
