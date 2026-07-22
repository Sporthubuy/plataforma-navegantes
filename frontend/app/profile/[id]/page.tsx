'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, MapPin } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/ui/card';
import { CvPanel } from '@/components/cv/cv-panel';
import { NauticalIdentity } from '@/components/community/nautical-identity';
import { CvActions } from '@/components/cv/cv-actions';
import {
  CommunityStats,
  FollowButton,
  type CommunityStatsData,
} from '@/components/community/community-stats';
import { CvSpecialties, VerifiedBadge } from '@/components/cv/cv-sections';
import { SocialLinks, RankBadge, formatMembership } from '@/components/profile/profile-extras';
import { formatLocation } from '@/lib/geo';
import type { ProfileWithCv } from '@/lib/types';

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<ProfileWithCv | null>(null);
  const [community, setCommunity] = useState<CommunityStatsData | null>(null);
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
  }, [params.id]);

  // Los números de comunidad se recargan solos al seguir/dejar de seguir.
  const loadCommunity = useCallback(() => {
    if (!params.id) return;
    api
      .get(`/api/community/${params.id}/stats`)
      .then((res) => setCommunity(res.data.stats))
      .catch(() => setCommunity(null));
  }, [params.id]);

  useEffect(load, [load]);
  useEffect(loadCommunity, [loadCommunity]);

  if (!profile) {
    return <AppShell><p className="text-navy-400">Cargando perfil…</p></AppShell>;
  }

  const isOwner = user?.id === profile.id;
  const summary = profile.professional_summary;

  return (
    <AppShell width="wide">
      <div className="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ─── Columna izquierda: sticky card de presentación ─── */}
        <div className="lg:sticky lg:top-8">
          <Card padded={false} className="overflow-hidden">
            <div className="h-24 bg-[linear-gradient(135deg,#14263d,#0A7C8A_60%,#16717a)] md:h-28" />
            <div className="px-5 pb-5">
              <div className="-mt-12 flex flex-col items-center text-center">
                <Avatar
                  src={profile.avatar_url}
                  name={profile.username}
                  className="h-20 w-20 border-4 border-white text-xl shadow-sm"
                />
                <h1 className="mt-3 flex items-center gap-1.5 text-lg font-bold text-navy-950">
                  {profile.name || `@${profile.username}`}
                  {profile.verified_badge && <VerifiedBadge />}
                </h1>
                <p className="text-sm text-navy-500">@{profile.username}</p>
                {summary?.headline && (
                  <p className="mt-1 text-sm font-semibold text-navy-700">{summary.headline}</p>
                )}

                {formatLocation(profile.city, profile.country) && (
                  <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-navy-500">
                    <MapPin className="h-3 w-3" />
                    {formatLocation(profile.city, profile.country)}
                  </p>
                )}

                {profile.club && (
                  <p className="mt-0.5 text-xs text-navy-500">{profile.club.name}</p>
                )}

                {profile.created_at && (
                  <p className="mt-0.5 text-xs text-navy-400">
                    {formatMembership(profile.created_at)} a bordo
                  </p>
                )}

                {profile.sailor_rank && <RankBadge rank={profile.sailor_rank} />}
              </div>

              {community && (
                <div className="mt-4">
                  <CommunityStats userId={profile.id} stats={community} />
                </div>
              )}

              {visible && (
                <div className="mt-4 flex flex-col gap-2">
                  {!isOwner && (
                    <div className="flex gap-2">
                      <FollowButton userId={profile.id} onChange={loadCommunity} />
                    </div>
                  )}
                  <CvActions profile={profile} isOwner={isOwner} />
                </div>
              )}

              {summary && (
                <div className="mt-4 border-t border-navy-100 pt-4">
                  <CvSpecialties summary={summary} />
                </div>
              )}

              {visible && <SocialLinks profile={profile} />}
            </div>
          </Card>
        </div>

        {/* ─── Columna derecha: secciones ─── */}
        <div className="mt-6 lg:mt-0">
          {visible ? (
            <div className="flex flex-col gap-8">
              <NauticalIdentity userId={profile.id} isOwner={isOwner} />
              <CvPanel profile={profile} isOwner={isOwner} onRefresh={load} />
            </div>
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