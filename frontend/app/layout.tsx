import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const DESCRIPTION =
  "Conecta con navegantes, descubre regatas, encuentra tripulación y comparte tus travesías.";

export const metadata: Metadata = {
  // Las páginas hijas completan el título con su propio nombre.
  title: {
    default: "Navegantes | Comunidad náutica",
    template: "%s | Navegantes",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Navegantes | Comunidad náutica",
    description: DESCRIPTION,
    siteName: "Navegantes",
    locale: "es_UY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Navegantes | Comunidad náutica",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Antes de pintar: evita el destello claro al cargar en oscuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
