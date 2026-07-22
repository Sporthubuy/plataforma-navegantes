import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Ajustes',
  description: 'Gestioná tu cuenta, tus guardados y tus preferencias.',
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
