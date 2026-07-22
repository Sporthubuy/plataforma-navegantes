import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Invitaciones',
  description: 'Invitaciones de tripulación pendientes de respuesta.',
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return children;
}
