'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, Mail } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button, buttonClasses } from '@/components/ui/button';
import { instagramUrl } from '@/components/profile/profile-extras';
import type { ProfileWithCv } from '@/lib/types';

/** Enlaces públicos que el navegante ya eligió publicar. */
function contactLinks(profile: ProfileWithCv) {
  const links: { label: string; href: string }[] = [];
  if (profile.instagram) {
    links.push({
      label: `Instagram · @${profile.instagram}`,
      href: instagramUrl(profile.instagram),
    });
  }
  if (profile.facebook) {
    links.push({
      label: 'Facebook',
      href: /^https?:\/\//i.test(profile.facebook)
        ? profile.facebook
        : `https://facebook.com/${profile.facebook}`,
    });
  }
  if (profile.youtube) {
    links.push({
      label: 'YouTube',
      href: /^https?:\/\//i.test(profile.youtube)
        ? profile.youtube
        : `https://youtube.com/@${profile.youtube}`,
    });
  }
  if (profile.website) {
    links.push({ label: 'Sitio web', href: profile.website });
  }
  return links;
}

/**
 * Contacto: la plataforma todavía no tiene mensajería, así que en vez
 * de inventar un canal se ofrecen los enlaces que el navegante ya
 * publicó y la vía que sí existe hoy (los clasificados).
 */
function ContactModal({
  profile,
  onClose,
}: {
  profile: ProfileWithCv;
  onClose: () => void;
}) {
  const links = contactLinks(profile);
  const name = profile.name || `@${profile.username}`;

  return (
    <Modal title={`Contactar a ${name}`} onClose={onClose}>
      {links.length > 0 ? (
        <>
          <p className="text-sm text-navy-600">
            Estos son los canales que {name} publicó en su perfil:
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring block rounded-lg border border-navy-100 px-3 py-2.5 text-sm font-semibold text-navy-800 hover:border-water-600/30 hover:bg-water-50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-navy-600">
          {name} todavía no publicó ningún medio de contacto.
        </p>
      )}

      <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">
        Todavía no hay mensajería dentro de la plataforma. Mientras tanto,
        publicar un clasificado es la forma de que te encuentren.
      </p>

      <Link
        href="/classifieds/new"
        className={`${buttonClasses('primary', 'md')} mt-3 w-full`}
      >
        Publicar un clasificado
      </Link>
    </Modal>
  );
}

/**
 * Acciones del CV. "Descargar" usa la impresión del navegador (que
 * permite guardar como PDF) en vez de generar el archivo en el cliente:
 * sin dependencias nuevas y respeta el formato que el usuario elija.
 */
export function CvActions({
  profile,
  isOwner,
}: {
  profile: ProfileWithCv;
  isOwner: boolean;
}) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row print:hidden">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.print()}
          className="flex-1"
        >
          <Download className="h-4 w-4" />
          Descargar CV
        </Button>

        {!isOwner && (
          <Button
            size="sm"
            onClick={() => setContactOpen(true)}
            className="flex-1"
          >
            <Mail className="h-4 w-4" />
            Contactar
          </Button>
        )}
      </div>

      {contactOpen && (
        <ContactModal profile={profile} onClose={() => setContactOpen(false)} />
      )}
    </>
  );
}
