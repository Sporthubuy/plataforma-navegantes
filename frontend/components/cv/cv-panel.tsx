'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trophy } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { EmptyState } from '@/components/empty-state';
import { AchievementTimeline } from './achievement-timeline';
import { CredentialModal, ManualAchievementModal } from './cv-modals';
import {
  CertifiedCoachBanner,
  CvCredentials,
  CvSpecialties,
  CvStats,
} from './cv-sections';
import type { ProfileWithCv } from '@/lib/types';

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-navy-900">{title}</h2>
      {action}
    </div>
  );
}

function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-water-600 hover:bg-water-50"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
}

/**
 * Bloque de CV náutico: se usa igual en el perfil propio y en el de
 * otro navegante. `isOwner` decide qué se puede editar.
 *
 * Si el perfil es privado y quien mira no es el dueño, el backend ya
 * devuelve credenciales y logros vacíos: acá no hace falta filtrar nada.
 */
export function CvPanel({
  profile,
  isOwner,
  onRefresh,
}: {
  profile: ProfileWithCv;
  isOwner: boolean;
  onRefresh: () => void;
}) {
  const [credentialModal, setCredentialModal] = useState(false);
  const [achievementModal, setAchievementModal] = useState(false);

  const summary = profile.professional_summary ?? null;
  const stats = profile.achievement_stats;
  const credentials = profile.credentials ?? [];
  const achievements = profile.achievements ?? [];

  async function deleteCredential(id: string) {
    if (!confirm('¿Borrar este título?')) return;
    try {
      await api.delete(`/api/users/profile/${profile.id}/credentials/${id}`);
      toast.success('Título borrado');
      onRefresh();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  async function deleteAchievement(id: string) {
    if (!confirm('¿Borrar este logro del historial?')) return;
    try {
      await api.delete(`/api/users/profile/${profile.id}/achievements/${id}`);
      toast.success('Logro borrado');
      onRefresh();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <CertifiedCoachBanner credentials={credentials} />

      {summary?.professional_bio && (
        <section>
          <SectionHeader title="Perfil profesional" />
          <p className="max-w-prose text-[15px] whitespace-pre-wrap text-navy-700">
            {summary.professional_bio}
          </p>
        </section>
      )}

      {stats && (
        <section>
          <SectionHeader title="Trayectoria" />
          <CvStats stats={stats} />
        </section>
      )}

      {summary && (
        <section>
          <SectionHeader title="Especialidades y disponibilidad" />
          <CvSpecialties summary={summary} />
        </section>
      )}

      <section>
        <SectionHeader
          title="Títulos y certificaciones"
          action={
            isOwner && (
              <AddButton
                label="Agregar título"
                onClick={() => setCredentialModal(true)}
              />
            )
          }
        />
        {credentials.length === 0 ? (
          <p className="text-sm text-navy-400">
            {isOwner
              ? 'Todavía no cargaste títulos ni certificaciones.'
              : 'Este navegante no publicó títulos.'}
          </p>
        ) : (
          <CvCredentials
            credentials={credentials}
            isOwner={isOwner}
            onDelete={deleteCredential}
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="Historial de regatas"
          action={
            isOwner && (
              <AddButton
                label="Agregar logro"
                onClick={() => setAchievementModal(true)}
              />
            )
          }
        />
        {achievements.length === 0 ? (
          <EmptyState
            title="Todavía no hay logros"
            subtitle={
              isOwner
                ? 'Cuando corras una regata en la plataforma va a aparecer sola. Mientras tanto, podés cargar tu historial anterior.'
                : 'Este navegante todavía no tiene regatas registradas.'
            }
            icon={<Trophy className="h-10 w-10 text-navy-300" />}
            actions={
              isOwner ? [{ label: 'Ver regatas', href: '/regattas' }] : undefined
            }
          />
        ) : (
          <AchievementTimeline
            achievements={achievements}
            total={profile.achievements_total ?? achievements.length}
            isOwner={isOwner}
            onDelete={deleteAchievement}
          />
        )}
      </section>

      {credentialModal && (
        <CredentialModal
          userId={profile.id}
          onClose={() => setCredentialModal(false)}
          onSaved={onRefresh}
        />
      )}
      {achievementModal && (
        <ManualAchievementModal
          userId={profile.id}
          onClose={() => setAchievementModal(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}
