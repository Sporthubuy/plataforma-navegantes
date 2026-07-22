import type { ReactNode } from 'react';

/**
 * Sección con header tipo LinkedIn: título a la izquierda, acción
 * opcional (botón editar / agregar) a la derecha. Cuerpo libre.
 */
export function ProfileSection({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-navy-100 bg-white p-5 ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-navy-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}