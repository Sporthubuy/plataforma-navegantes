import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Clasificados',
  description: 'Buscá tripulación, profesor o barco en la comunidad náutica.',
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return children;
}
