'use client';

import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Circle, Download, Pencil } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import type { ClassResults, Race } from '@/lib/types';

/**
 * Estado de una manga de un vistazo. `scheduled` con resultados
 * cargados no existe: el backend la pasa a `completed` al guardar.
 */
function raceState(race: Race): {
  label: string;
  icon: typeof Circle;
  className: string;
} {
  if (race.status === 'abandoned') {
    return {
      label: 'Anulada',
      icon: AlertTriangle,
      className: 'text-sand-700',
    };
  }
  if (race.status === 'completed') {
    return {
      label: 'Cargada',
      icon: CheckCircle2,
      className: 'text-sage-700',
    };
  }
  return { label: 'Sin cargar', icon: Circle, className: 'text-navy-400' };
}

/**
 * Panel de situación de la clase: qué falta para poder cerrarla.
 *
 * En una regata de varios días esto es lo primero que mira el comité,
 * y hasta ahora había que contar a ojo manga por manga.
 */
export function ClassStatusPanel({ data }: { data: ClassResults }) {
  const scheduled = data.races.filter((r) => r.status === 'scheduled');
  const abandoned = data.races.filter((r) => r.status === 'abandoned');

  // Un barco sin resultado en una manga cargada quedó sin resolver.
  const completedIds = new Set(
    data.races.filter((r) => r.status === 'completed').map((r) => r.id)
  );
  const unresolved = data.standings.filter((s) => {
    const scored = s.races.filter((rp) => completedIds.has(rp.race_id)).length;
    return scored < completedIds.size;
  }).length;

  const ready =
    scheduled.length === 0 && unresolved === 0 && completedIds.size > 0;

  const rows = [
    {
      label: 'Mangas cargadas',
      value: `${completedIds.size} de ${data.races.length - abandoned.length}`,
      ok: scheduled.length === 0,
    },
    {
      label: 'Barcos sin resolver',
      value: String(unresolved),
      ok: unresolved === 0,
    },
    {
      label: 'Descartes aplicados',
      value: String(data.effective_discards),
      ok: true,
    },
  ];

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-navy-900">Situación</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            ready
              ? 'bg-sage-100 text-sage-700'
              : 'bg-sand-100 text-sand-700'
          }`}
        >
          {ready ? 'Lista para cerrar' : 'Falta cargar'}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-navy-400">{r.label}</dt>
            <dd
              className={`text-lg font-bold ${
                r.ok ? 'text-navy-900' : 'text-sand-700'
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      {abandoned.length > 0 && (
        <p className="mt-3 text-xs text-navy-400">
          {abandoned.length}{' '}
          {abandoned.length === 1 ? 'manga anulada' : 'mangas anuladas'}: no
          puntúan.
        </p>
      )}
    </div>
  );
}

/** Edición de una manga: nombre, fecha y anulación. */
export function EditRaceModal({
  race,
  onClose,
  onSaved,
}: {
  race: Race;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(race.name ?? '');
  const [status, setStatus] = useState(race.status);
  const [reason, setReason] = useState(race.abandoned_reason ?? '');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/api/regattas/races/${race.id}`, {
        name: name.trim() || null,
        status,
        abandoned_reason: status === 'abandoned' ? reason.trim() || null : null,
      });
      toast.success('Manga actualizada');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo actualizar'));
      setSaving(false);
    }
  }

  return (
    <Modal title={`Manga ${race.race_number}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Nombre" hint="Opcional: “Medal race”, “Costera”…">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder={`Manga ${race.race_number}`}
          />
        </Field>

        <Field
          label="Estado"
          hint="Anular deja la manga a la vista pero fuera del puntaje."
        >
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as Race['status'])}
          >
            <option value="scheduled">Programada</option>
            <option value="completed">Navegada</option>
            <option value="abandoned">Anulada</option>
          </Select>
        </Field>

        {status === 'abandoned' && (
          <Field label="Motivo de la anulación">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Salida general anulada, viento fuera de rango…"
            />
          </Field>
        )}

        <Button type="submit" disabled={saving} fullWidth>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}

/** Botón de edición para la cabecera de cada manga. */
export function EditRaceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Editar manga"
      className="focus-ring rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700"
    >
      <Pencil className="h-4 w-4" />
    </button>
  );
}

export { raceState };

/**
 * Exporta la clasificación a CSV. Es lo primero que pide cualquier
 * organizador: el resultado oficial va al tablón y a la federación.
 */
export function ExportResultsButton({
  data,
  className,
}: {
  data: ClassResults;
  className?: string;
}) {
  function download() {
    const scored = data.races.filter((r) => r.status === 'completed');
    const header = [
      'Puesto',
      'Barco',
      'Vela',
      'Timonel',
      ...scored.map((r) => r.name || `M${r.race_number}`),
      'Neto',
      'Bruto',
    ];

    const lines = data.standings.map((s) => {
      const boat = s.entry?.boat;
      const cells = scored.map((race) => {
        const rp = s.races.find((x) => x.race_id === race.id);
        if (!rp) return '';
        const text = rp.code ?? String(rp.position ?? '');
        // Los descartes se marcan entre paréntesis, como en el papel.
        return rp.discarded ? `(${text})` : text;
      });
      return [
        String(s.rank),
        boat?.name ?? '',
        s.entry?.sail_number ?? '',
        boat?.owner?.username ?? '',
        ...cells,
        String(s.total),
        String(s.gross_total),
      ];
    });

    // Se citan todos los campos: los nombres de barco traen comas.
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // BOM para que Excel abra los acentos bien.
    const blob = new Blob([`﻿${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resultados-${data.regatta_class.sailing_class}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="secondary" onClick={download} className={className}>
      <Download className="h-4 w-4" />
      Exportar CSV
    </Button>
  );
}

/** Alta manual de una inscripción desde el gestor. */
export function AddEntryModal({
  classId,
  sailingClass,
  onClose,
  onSaved,
}: {
  classId: string;
  sailingClass: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState('');
  const [boats, setBoats] = useState<
    { id: string; name: string; sail_number: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function search(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    try {
      const res = await api.get('/api/admin/boats', {
        params: { search: query.trim(), limit: 20 },
      });
      // Solo barcos de la clase: el backend rechaza el resto igual.
      setBoats(
        (res.data.boats ?? []).filter(
          (b: { category: string }) => b.category === sailingClass
        )
      );
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo buscar'));
    } finally {
      setSearching(false);
    }
  }

  async function add(boatId: string) {
    setSubmitting(boatId);
    try {
      await api.post(`/api/regattas/classes/${classId}/register`, {
        boat_id: boatId,
        on_behalf: true,
      });
      toast.success('Barco inscripto');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo inscribir'));
      setSubmitting(null);
    }
  }

  return (
    <Modal title={`Inscribir en ${sailingClass}`} onClose={onClose}>
      <p className="mb-3 text-sm text-navy-500">
        Para anotar a quien se inscribió en papel. Solo aparecen barcos de la
        clase.
      </p>

      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nombre del barco…"
          aria-label="Buscar barco"
        />
        <Button type="submit" size="sm" disabled={searching}>
          Buscar
        </Button>
      </form>

      <ul className="mt-3 flex flex-col gap-2">
        {boats.map((b) => (
          <li
            key={b.id}
            className="flex items-center gap-3 rounded-lg border border-navy-100 p-2"
          >
            <span className="min-w-0 flex-1 truncate text-sm text-navy-800">
              {b.name}
              {b.sail_number && (
                <span className="ml-1 text-xs text-navy-400">
                  {b.sail_number}
                </span>
              )}
            </span>
            <Button
              size="sm"
              disabled={submitting === b.id}
              onClick={() => add(b.id)}
            >
              {submitting === b.id ? '…' : 'Inscribir'}
            </Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
