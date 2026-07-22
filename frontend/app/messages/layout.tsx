import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/** La página es un client component: su metadata se declara acá. */
export const metadata: Metadata = {
  title: 'Mensajes',
  description: 'Tus conversaciones con otros navegantes.',
};

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return children;
}
