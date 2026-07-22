import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * La página es un client component, así que el título y el Open Graph
 * se resuelven acá en el servidor con el post real (GET público).
 * Si la API no responde, cae en un título genérico.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API_URL}/api/posts/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error('sin post');

    const { post } = await res.json();
    const description: string = (post.content ?? '').slice(0, 160);

    return {
      title: post.title,
      description,
      openGraph: {
        title: post.title,
        description,
        type: 'article',
        images: post.image_url ? [post.image_url] : undefined,
      },
    };
  } catch {
    return { title: 'Entrada' };
  }
}

export default function PostLayout({ children }: { children: ReactNode }) {
  return children;
}
