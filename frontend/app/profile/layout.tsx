import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  // Un `title` plano acá cortaría la plantilla del layout raíz para
  // /profile/[id], así que se vuelve a declarar.
  title: {
    default: 'Mi perfil',
    template: '%s | Navegantes',
  },
  description: 'Tu perfil de navegante: datos náuticos, barcos y logros.',
};

export default function SectionLayout({ children }: { children: ReactNode }) {
  return children;
}
