import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/**
 * La página de Inicio es un client component, así que su metadata se
 * declara acá (el template del layout raíz agrega "| Navegantes").
 */
export const metadata: Metadata = {
  title: 'Inicio',
  description:
    'Tu feed de Navegantes: travesías, regatas, clasificados e invitaciones de tripulación.',
};

export default function HomeLayout({ children }: { children: ReactNode }) {
  return children;
}
