'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Sailboat, Trophy } from 'lucide-react';
import { api, getApiError } from '@/lib/api';
import { EmptyState } from '@/components/empty-state';
import { AchievementTimeline } from './achievement-timeline';
import { WorkExperienceList } from './work-experience-list';
import {
  CredentialModal,
  ManualAchievementModal,
  WorkExperienceModal,
  SailingHoursModal,
  CommunityAchievementBadges,
} from './cv-modals';
import { RankBadge } from '@/components/profile/profile-extras';
import {
  CertifiedCoachBanner,
  CvCredentials,
  CvSpecialties,
  CvStats,
} from './cv-sections';
import { ProfileSection } from '@/components/profile/profile-section';
import type { ProfileWithCv, SailingHourEntry } from '@/lib/types';

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
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
 * Sección total del CV náutico tipo LinkedIn. Las secciones son cards
 * independientes con header consistente (título + acción). Reutilizable
 * en el perfil propio y en el público.
 *
 * `boats` (opcional) se renderiza como una sección más al final — así
 * los barcos viven en el contexto del CV náutico del navegante en vez
 * de estar sueltos en la página.
 */
export function CvPanel({
  profile,
  isOwner,
  onRefresh,
  boats,
}: {
  profile: ProfileWithCv;
  isOwner: boolean;
  onRefresh: () => void;
  boats?: React.ReactNode;
}) {
  const [credentialModal, setCredentialModal] = useState(false);
  const [achievementModal, setAchievementModal] = useState(false);
  const [workModal, setWorkModal] = useState(false);
  const [sailingModal, setSailingModal] = useState(false);
  const [sailingHours, setSailingHours] = useState<SailingHourEntry[]>([]);
  const [hoursLoading, setHoursLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setHoursLoading(true);
      try {
        const res = await api.get(`/api/users/profile/${profile.id}/sailing-hours?limit=5`);
        if (!cancelled) setSailingHours(res.data.entries ?? []);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHoursLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [profile.id]);

  const summary = profile.professional_summary ?? null;
  const stats = profile.achievement_stats;
  const credentials = profile.credentials ?? [];
  const achievements = profile.achievements ?? [];
  const work = profile.work_experience ?? [];

  // "Acerca de" muestra la bio personal y/o la profesional: separadas
  // por un guion sutil si ambas existen, para no mezclar registro.
  const aboutTexts = [profile.bio, summary?.professional_bio].filter(Boolean) as string[];

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

  async function deleteWork(id: string) {
    if (!confirm('¿Borrar este cargo del historial laboral?')) return;
    try {
      await api.delete(`/api/users/profile/${profile.id}/work/${id}`);
      toast.success('Cargo borrado');
      onRefresh();
    } catch (err) {
      toast.error(getApiError(err, 'No se pudo borrar'));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <CertifiedCoachBanner credentials={credentials} />

      {aboutTexts.length > 0 && (
        <ProfileSection title="Acerca de">
          <div className="flex flex-col gap-3">
            {profile.bio && (
              <p className="max-w-prose text-sm whitespace-pre-wrap text-navy-700 leading-relaxed">
                {profile.bio}
              </p>
            )}
            {summary?.professional_bio && (
              <p className="max-w-prose text-sm whitespace-pre-wrap text-navy-600 leading-relaxed">
                {summary.professional_bio}
              </p>
            )}
          </div>
        </ProfileSection>
      )}

      {stats && (
        <ProfileSection title="Trayectoria">
          <CvStats stats={stats} />
        </ProfileSection>
      )}

      {summary && (
        <ProfileSection title="Especialidades y disponibilidad">
          <CvSpecialties summary={summary} />
        </ProfileSection>
      )}

      {/* ─── Actividad: rango, horas de mar y logros comunitarios ─── */}
      <ProfileSection
        title="Actividad"
        action={
          isOwner && (
            <AddButton label="Registrar salida" onClick={() => setSailingModal(true)} />
          )
        }
      >
        <div className="flex flex-col gap-4">
          {profile.sailor_rank && <RankBadge rank={profile.sailor_rank} />}

          {sailingHours.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-navy-500 uppercase tracking-wide">Últimas salidas</p>
              <div className="flex flex-col gap-2">
                {sailingHours.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-navy-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Sailboat className="h-4 w-4 text-navy-400" />
                      <span className="text-navy-700">
                        {new Date(e.sailed_date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {e.sailing_class && (
                        <span className="text-navy-400">· {e.sailing_class}</span>
                      )}
                    </div>
                    <span className="font-medium text-navy-800">{e.hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hoursLoading && sailingHours.length === 0 && !profile.sailor_rank && (
            <p className="text-sm text-navy-400">
              {isOwner
                ? 'Registrá tus primeras horas de navegación para empezar a sumar.'
                : 'Este navegante todavía no registró actividad.'}
            </p>
          )}

          <CommunityAchievementBadges achievements={profile.community_achievements ?? []} />
        </div>
      </ProfileSection>

      <ProfileSection
        title="Títulos y certificaciones"
        action={
          isOwner && (
            <AddButton label="Agregar título" onClick={() => setCredentialModal(true)} />
          )
        }
      >
        {credentials.length === 0 ? (
          <p className="text-sm text-navy-400">
            {isOwner
              ? 'Todavía no cargaste títulos ni certificaciones.'
              : 'Este navegante no publicó títulos.'}
          </p>
        ) : (
          <CvCredentials credentials={credentials} isOwner={isOwner} onDelete={deleteCredential} />
        )}
      </ProfileSection>

      <ProfileSection
        title="Experiencia laboral en la industria"
        action={
          isOwner && (
            <AddButton label="Agregar cargo" onClick={() => setWorkModal(true)} />
          )
        }
      >
        <WorkExperienceList jobs={work} isOwner={isOwner} onDelete={deleteWork} />
      </ProfileSection>

      <ProfileSection
        title="Historial de regatas"
        action={
          isOwner && (
            <AddButton label="Agregar logro" onClick={() => setAchievementModal(true)} />
          )
        }
      >
        {achievements.length === 0 ? (
          <EmptyState
            title="Todavía no hay logros"
            subtitle={
              isOwner
                ? 'Cuando corras una regata en la plataforma va a aparecer sola. Mientras tanto, podés cargar tu historial anterior.'
                : 'Este navegante todavía no tiene regatas registradas.'
            }
            icon={<Trophy className="h-10 w-10 text-navy-300" />}
            compact
            actions={isOwner ? [{ label: 'Ver regatas', href: '/regattas' }] : undefined}
          />
        ) : (
          <AchievementTimeline
            achievements={achievements}
            total={profile.achievements_total ?? achievements.length}
            isOwner={isOwner}
            onDelete={deleteAchievement}
          />
        )}
      </ProfileSection>

      {boats && <ProfileSection title="Barcos">{boats}</ProfileSection>}

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
      {workModal && (
        <WorkExperienceModal
          userId={profile.id}
          onClose={() => setWorkModal(false)}
          onSaved={onRefresh}
        />
      )}

      {sailingModal && (
        <SailingHoursModal
          userId={profile.id}
          onClose={() => setSailingModal(false)}
          onSaved={(entry) => {
            setSailingHours((prev) => [entry, ...prev].slice(0, 5));
            onRefresh();
          }}
        />
      )}
    </div>
  );
}