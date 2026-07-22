import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Regatas',
  description: 'Campeonatos, clases, inscripciones y resultados.',
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return children;
}
