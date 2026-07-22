'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { CvPanel } from '@/components/cv/cv-panel';
import { CvSpecialties, VerifiedBadge } from '@/components/cv/cv-sections';
import { formatLocation } from '@/lib/geo';
import type { ProfileStats, ProfileWithCv } from '@/lib/types';

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileWithCv | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  // El backend avisa si abrió el perfil entero o solo la presentación.
  const [visible, setVisible] = useState(true);

  const load = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/users/profile/${params.id}`)
      .then((res) => {
        setProfile(res.data.profile);
        setVisible(res.data.visible !== false);
      })
      .catch(() => setProfile(null));
    api
      .get(`/api/users/profile/${params.id}/stats`)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [params.id]);

  useEffect(load, [load]);

  if (!profile) {
    return (
      <AppShell>
        <p className="text-navy-400">Cargando perfil…</p>
      </AppShell>
    );
  }

  const isOwner = user?.id === profile.id;
  const summary = profile.professional_summary;

  return (
    <AppShell width="wide">
      <Link
        href="/explore"
        className="text-sm font-semibold text-navy-500 hover:underline"
      >
        ← Volver
      </Link>

      <div className="mt-4 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        {/* Tarjeta de presentación — fija al scrollear en desktop */}
        <Card className="overflow-hidden p-0 lg:sticky lg:top-6">
          <div className="h-24 bg-[linear-gradient(120deg,#17324d,#2c7181_60%,#d7aa62)]" />
          <div className="p-5">
            <div className="-mt-14 flex flex-col items-start gap-3">
              <Avatar
                src={profile.avatar_url}
                name={profile.username}
                className="h-24 w-24 border-4 border-white text-2xl"
              />
              <div className="min-w-0">
                <h1 className="flex items-center gap-1.5 text-xl font-bold text-navy-950">
                  {profile.name || `@${profile.username}`}
                  {profile.verified_badge && <VerifiedBadge />}
                </h1>
                <p className="text-sm font-semibold text-water-600">
                  @{profile.username}
                </p>
              </div>
            </div>

            {summary?.headline && (
              <p className="mt-3 text-sm font-semibold text-navy-700">
                {summary.headline}
              </p>
            )}

            <dl className="mt-4 flex flex-col gap-1 text-sm text-navy-600">
              {formatLocation(profile.city, profile.country) && (
                <div>{formatLocation(profile.city, profile.country)}</div>
              )}
              {profile.club && <div>{profile.club.name}</div>}
              {summary?.experience_years != null && (
                <div>{summary.experience_years} años de experiencia</div>
              )}
              {stats && (
                <div className="text-navy-400">
                  {stats.boats_owned} barcos · {stats.crews_joined} tripulaciones
                </div>
              )}
            </dl>

            {summary && (
              <div className="mt-4">
                <CvSpecialties summary={summary} />
              </div>
            )}

            {profile.bio && visible && (
              <p className="mt-4 text-sm whitespace-pre-wrap text-navy-700">
                {profile.bio}
              </p>
            )}
          </div>
        </Card>

        <div className="mt-6 lg:mt-0">
          {visible ? (
            <CvPanel profile={profile} isOwner={isOwner} onRefresh={load} />
          ) : (
            <Card className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-navy-400" />
              <div>
                <p className="font-semibold text-navy-900">Perfil privado</p>
                <p className="mt-1 text-sm text-navy-500">
                  Este navegante eligió no mostrar públicamente su historial,
                  sus títulos ni sus datos de contacto.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
