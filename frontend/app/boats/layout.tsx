import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Mis barcos',
  description: 'Tus barcos y las tripulaciones en las que navegás.',
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return children;
}
