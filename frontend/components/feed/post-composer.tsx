'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';

/** Modal para publicar una entrada en la bitácora. */
export function PostComposer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!title.trim()) return setError('El título es obligatorio');
    if (!content.trim()) return setError('Contá algo en el cuerpo');

    setSaving(true);
    try {
      await api.post('/api/posts', {
        title: title.trim(),
        content: content.trim(),
        image_url: imageUrl.trim() || null,
      });
      toast.success('¡Entrada publicada!');
      onCreated();
      onClose();
    } catch (err) {
      setError(getApiError(err, 'No se pudo publicar'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Nueva entrada" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Título">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Primera travesía de la temporada"
            autoFocus
          />
        </Field>
        <Field label="¿Qué querés contar?">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            placeholder="Viento del este, mar calma…"
          />
        </Field>
        <Field label="URL de imagen" hint="Opcional">
          <Input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Publicando…' : 'Publicar'}
        </Button>
      </form>
    </Modal>
  );
}
