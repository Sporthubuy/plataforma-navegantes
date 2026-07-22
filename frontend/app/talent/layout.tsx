import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Buscar tripulación',
  description:
    'Encontrá tripulantes, entrenadores y socios de regata por clase, zona y disponibilidad.',
};

export default function TalentLayout({ children }: { children: ReactNode }) {
  return children;
}
