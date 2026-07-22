import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Explorar',
  description:
    'Descubrí navegantes, regatas y clasificados de la comunidad náutica.',
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
