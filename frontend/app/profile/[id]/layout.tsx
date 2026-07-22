import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * La página es un client component, así que el título se resuelve acá
 * en el servidor con el perfil real (GET público). Sin esto heredaría
 * el "Mi perfil" del layout de /profile, que acá sería incorrecto.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/api/users/profile/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('sin perfil');

    const { profile } = await res.json();
    const name: string = profile.name || profile.username;

    return {
      title: name,
      description: profile.bio ?? `Perfil de ${name} en Navegantes.`,
      openGraph: {
        title: name,
        type: 'profile',
        images: profile.avatar_url ? [profile.avatar_url] : undefined,
      },
    };
  } catch {
    return { title: 'Perfil' };
  }
}

export default function ProfileDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
