'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Download, Mail } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
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
 * Contacto: escribe un mensaje directo. Los enlaces públicos siguen
 * apareciendo debajo como alternativa, pero el canal principal ya vive
 * dentro de la plataforma.
 */
function ContactModal({
  profile,
  onClose,
}: {
  profile: ProfileWithCv;
  onClose: () => void;
}) {
  const router = useRouter();
  const links = contactLinks(profile);
  const name = profile.name || `@${profile.username}`;
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/api/messages', {
        recipient_id: profile.id,
        body: body.trim(),
      });
      toast.success('Mensaje enviado');
      onClose();
      router.push(`/messages?c=${res.data.conversation_id}`);
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo enviar el mensaje'));
      setSending(false);
    }
  }

  return (
    <Modal title={`Escribirle a ${name}`} onClose={onClose}>
      <form onSubmit={send} className="flex flex-col gap-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={4000}
          autoFocus
          placeholder={`Contale a ${name} por qué le escribís: qué barco, qué clase, qué fechas…`}
        />
        <Button type="submit" disabled={sending || !body.trim()} fullWidth>
          {sending ? 'Enviando…' : 'Enviar mensaje'}
        </Button>
      </form>

      {links.length > 0 && (
        <div className="mt-4 border-t border-navy-100 pt-3">
          <p className="text-xs font-semibold text-navy-500">
            También podés encontrarlo en:
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring rounded-lg border border-navy-100 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
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
