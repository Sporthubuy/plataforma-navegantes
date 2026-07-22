'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import axios from 'axios';
import { MapPin, Plus } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { api, getApiError } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { Username } from '@/components/username';
import { Avatar } from '@/components/avatar';
import { BoatCard } from '@/components/boat-card';
import { BOAT_CATEGORIES } from '@/components/boat-form';
import { ClubPicker } from '@/components/club-picker';
import { LocationPicker } from '@/components/location-picker';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea, Select, controlClasses } from '@/components/ui/input';
import {
  NauticalData,
  SocialLinks,
  RankBadge,
  formatMembership,
} from '@/components/profile/profile-extras';
import { CvPanel } from '@/components/cv/cv-panel';
import { NauticalIdentity } from '@/components/community/nautical-identity';
import { CvActions } from '@/components/cv/cv-actions';
import { VerifiedBadge, CvSpecialties } from '@/components/cv/cv-sections';
import { ProfileCompleteness } from '@/components/profile/profile-completeness';
import { formatLocation } from '@/lib/geo';
import type { MyBoat, ProfileStats, ProfileWithCv, AvailabilityStatus } from '@/lib/types';
import { AVAILABILITY_STATUSES, AVAILABILITY_LABEL, SEEKING_ROLES, SEEKING_ROLE_LABEL } from '@/lib/types';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const INSTAGRAM_RE = /^[A-Za-z0-9._]{1,30}$/;
const CREW_ROLES = ['Timonel', 'Proa', 'Táctico', 'Trimmer', 'Piano', 'Stratega', 'Otro'];

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

interface ProfileForm {
  username: string;
  name: string;
  bio: string;
  birthDate: string;
  clubId: string | null;
  classSelect: string;
  classCustom: string;
  roleSelect: string;
  roleCustom: string;
  country: string | null;
  city: string | null;
  headline: string;
  professionalBio: string;
  specialties: string;
  experienceYears: string;
  seekingRole: string;
  availability: AvailabilityStatus;
  instagram: string;
  facebook: string;
  youtube: string;
  website: string;
}

const EMPTY_FORM: ProfileForm = {
  username: '', name: '', bio: '', birthDate: '', clubId: null,
  classSelect: '', classCustom: '', roleSelect: '', roleCustom: '',
  country: null, city: null, headline: '', professionalBio: '',
  specialties: '', experienceYears: '', seekingRole: '',
  availability: 'selective', instagram: '', facebook: '', youtube: '', website: '',
};

export default function ProfilePage() {
  const { user, loading, updateUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileWithCv | null>(null);
  const [boats, setBoats] = useState<MyBoat[] | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [usernameError, setUsernameError] = useState('');
  const [websiteError, setWebsiteError] = useState('');
  const [instagramError, setInstagramError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/auth/login');
  }, [loading, user, router]);

  const reloadProfile = useCallback(() => {
    if (!user) return;
    api
      .get(`/api/users/profile/${user.id}`)
      .then((res) => setProfile(res.data.profile))
      .catch(() => toast.error('No se pudo cargar el perfil'));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    reloadProfile();
    api.get('/api/boats/mine').then((res) => setBoats(res.data.boats)).catch(() => setBoats([]));
    api.get(`/api/users/profile/${user.id}/stats`).then((res) => setStats(res.data)).catch(() => setStats(null));
    api.get('/api/crew/invitations').then((res) => setPendingCount(res.data.invitations.length)).catch(() => setPendingCount(0));
  }, [user, reloadProfile]);

  if (loading || !user) {
    return <AppShell><p className="text-navy-400">Cargando…</p></AppShell>;
  }

  const shown: ProfileWithCv = profile ?? user;
  const summary = shown.professional_summary;

  function validateUsernameLive(value: string) {
    const normalized = value.trim().toLowerCase().replace(/^@/, '');
    if (!normalized) setUsernameError('El username es obligatorio');
    else if (!USERNAME_RE.test(normalized)) setUsernameError('3-20 caracteres: solo minúsculas, números y guion bajo');
    else setUsernameError('');
  }

  function startEditing() {
    const knownClass = shown.sailing_class && BOAT_CATEGORIES.includes(shown.sailing_class)
      ? shown.sailing_class : shown.sailing_class ? 'Otra' : '';
    const knownRole = shown.usual_role && CREW_ROLES.includes(shown.usual_role)
      ? shown.usual_role : shown.usual_role ? 'Otro' : '';
    setForm({
      username: shown.username, name: shown.name ?? '', bio: shown.bio ?? '',
      birthDate: shown.birth_date ?? '',
      clubId: shown.club_id ?? null, classSelect: knownClass,
      classCustom: knownClass === 'Otra' ? (shown.sailing_class ?? '') : '',
      roleSelect: knownRole, roleCustom: knownRole === 'Otro' ? (shown.usual_role ?? '') : '',
      country: shown.country ?? null, city: shown.city ?? null,
      headline: summary?.headline ?? '', professionalBio: summary?.professional_bio ?? '',
      specialties: (summary?.specialties ?? []).join(', '),
      experienceYears: summary?.experience_years != null ? String(summary.experience_years) : '',
      seekingRole: summary?.seeking_role ?? '', availability: summary?.availability_status ?? 'selective',
      instagram: shown.instagram ?? '', facebook: shown.facebook ?? '',
      youtube: shown.youtube ?? '', website: shown.website ?? '',
    });
    setUsernameError(''); setWebsiteError(''); setInstagramError(''); setEditing(true);
  }

  async function handleAvatarSelected(file: File | null) {
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setUploadingAvatar(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await api.post('/api/users/avatar', data);
      setProfile(res.data.profile);
      updateUser({ avatar_url: res.data.avatar_url });
      toast.success('Foto de perfil actualizada');
    } catch (err) {
      setAvatarPreview(null);
      toast.error(getApiError(err, 'No se pudo subir la foto'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const normalized = form.username.trim().toLowerCase().replace(/^@/, '');
    validateUsernameLive(normalized);
    if (!USERNAME_RE.test(normalized)) return;
    if (websiteError || instagramError) return;
    const sailingClass = form.classSelect === 'Otra' ? form.classCustom.trim() : form.classSelect;
    const usualRole = form.roleSelect === 'Otro' ? form.roleCustom.trim() : form.roleSelect;
    setSaving(true);
    try {
      const res = await api.put(`/api/users/profile/${user!.id}`, {
        username: normalized, name: form.name.trim() || null, bio: form.bio.trim() || null,
        birth_date: form.birthDate || null,
        club_id: form.clubId, sailing_class: sailingClass || null, usual_role: usualRole || null,
        country: form.country, city: form.city, headline: form.headline.trim() || null,
        professional_bio: form.professionalBio.trim() || null,
        specialties: form.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        experience_years: form.experienceYears.trim() || null,
        seeking_role: form.seekingRole || null, availability_status: form.availability,
        instagram: form.instagram.trim() || null, facebook: form.facebook.trim() || null,
        youtube: form.youtube.trim() || null, website: form.website.trim() || null,
      });
      setProfile(res.data.profile);
      updateUser(res.data.profile);
      setEditing(false);
      toast.success('Perfil actualizado');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) setUsernameError('Ese username ya está en uso');
      else toast.error(getApiError(err, 'No se pudo guardar el perfil'));
    } finally {
      setSaving(false);
    }
  }

  const avatarShown = avatarPreview ?? shown.avatar_url;
  const set = (patch: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...patch }));

  /** Cuerpo de la sección de barcos que se inyecta en el CvPanel. */
  const boatsSection = (
    <>
      {boats === null ? (
        <p className="text-sm text-navy-400">Cargando barcos…</p>
      ) : boats.length === 0 ? (
        <p className="text-sm text-navy-500">
          Todavía no tienes barcos.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {boats.map((boat) => (
            <BoatCard key={`${boat.id}-${boat.relation}`} boat={boat} />
          ))}
        </div>
      )}
      <Link href="/boats/new" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-water-600 hover:underline">
        <Plus className="h-4 w-4" /> Agregar barco
      </Link>
    </>
  );

  return (
    <AppShell width="wide">
      <h1 className="sr-only">Mi perfil</h1>

      {pendingCount > 0 && !editing && (
        <Link
          href="/invitations"
          className="mb-5 flex items-center gap-3 rounded-xl border border-water-600/30 bg-water-50 p-4"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-water-600 text-white text-sm">🔔</span>
          <span className="flex-1 text-sm font-medium text-navy-800">
            Tienes {pendingCount} {pendingCount === 1 ? 'invitación pendiente' : 'invitaciones pendientes'}
          </span>
          <span className="text-water-600">›</span>
        </Link>
      )}

      <div className="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ─── Columna izquierda: card de identidad (sticky en desktop) ─── */}
        <div className="lg:sticky lg:top-8">
          <Card padded={false} className="overflow-hidden">
            <div className="h-24 bg-[linear-gradient(135deg,#14263d,#0A7C8A_60%,#16717a)] md:h-28" />

            {editing ? (
              /* ─── EDIT MODE ─── */
              <form onSubmit={handleSave}>
                <div className="px-5 pb-5">
                  <div className="-mt-12 flex flex-col items-start gap-3 sm:flex-row sm:items-end">
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="relative shrink-0 rounded-full ring-2 ring-navy-300 ring-offset-2 cursor-pointer"
                      aria-label="Cambiar foto de perfil"
                    >
                      <Avatar src={avatarShown} name={shown.username} className="h-20 w-20 border-4 border-white text-xl" />
                      {uploadingAvatar && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-navy-950/60 text-xs font-medium text-white">Subiendo…</span>
                      )}
                      {!uploadingAvatar && (
                        <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-navy-800 text-white text-xs shadow">📷</span>
                      )}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleAvatarSelected(e.target.files?.[0] ?? null)} />
                  </div>

                  <div className="mt-5 flex flex-col gap-4">
                    <Field label="Username" error={usernameError}>
                      <div className={`flex items-center rounded-lg border px-3 focus-within:ring-2 ${usernameError ? 'border-red-300 focus-within:ring-red-200' : 'border-navy-200 focus-within:border-navy-500 focus-within:ring-navy-200'}`}>
                        <span className="text-base text-navy-400">@</span>
                        <input value={form.username} onChange={(e) => { const v = e.target.value.replace(/^@/, ''); set({ username: v }); validateUsernameLive(v); }} className="w-full bg-transparent py-2.5 pl-0.5 text-base outline-none" autoCapitalize="none" autoCorrect="off" />
                      </div>
                    </Field>
                    <Field label="Nombre"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                    <Field label="Bio"><Textarea value={form.bio} onChange={(e) => set({ bio: e.target.value })} rows={3} placeholder="Cuéntanos sobre ti y tu barco…" /></Field>
                    <Field label="Fecha de nacimiento" hint="Solo la ven quienes pueden ver tu perfil.">
                      <Input
                        type="date"
                        value={form.birthDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => set({ birthDate: e.target.value })}
                      />
                    </Field>

                    <fieldset className="flex flex-col gap-4 border-t border-navy-100 pt-4">
                      <legend className="text-sm font-bold text-navy-900">Perfil profesional</legend>
                      <Field label="Titular" hint="Una línea, como en LinkedIn."><Input value={form.headline} maxLength={160} onChange={(e) => set({ headline: e.target.value })} placeholder="Timonel · Instructor ILCA · Campeón Nacional 2022" /></Field>
                      <Field label="Experiencia"><Textarea value={form.professionalBio} rows={4} maxLength={2000} onChange={(e) => set({ professionalBio: e.target.value })} placeholder="Contá tu trayectoria: clases, roles, resultados, alumnos…" /></Field>
                      <Field label="Especialidades" hint="Separadas por comas."><Input value={form.specialties} onChange={(e) => set({ specialties: e.target.value })} placeholder="Snipe, ILCA, Estrategia" /></Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Años de experiencia"><Input value={form.experienceYears} inputMode="numeric" onChange={(e) => set({ experienceYears: e.target.value })} placeholder="11" /></Field>
                        <Field label="Disponibilidad"><Select value={form.availability} onChange={(e) => set({ availability: e.target.value as AvailabilityStatus })}>{AVAILABILITY_STATUSES.map((a) => (<option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>))}</Select></Field>
                      </div>
                      <Field label="Qué buscás" hint="Define en qué búsquedas aparecés."><Select value={form.seekingRole} onChange={(e) => set({ seekingRole: e.target.value })}><option value="">No estoy buscando nada</option>{SEEKING_ROLES.map((r) => (<option key={r} value={r}>{SEEKING_ROLE_LABEL[r]}</option>))}</Select></Field>
                    </fieldset>

                    <fieldset className="flex flex-col gap-4 border-t border-navy-100 pt-4">
                      <legend className="text-sm font-bold text-navy-900">Datos de navegación</legend>
                      <ClubPicker value={form.clubId} onChange={(clubId) => set({ clubId })} label="Club" hint="Del catálogo de la plataforma." />
                      <Field label="Clase / categoría"><Select value={form.classSelect} onChange={(e) => set({ classSelect: e.target.value })}><option value="">Sin especificar</option>{BOAT_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}</Select></Field>
                      {form.classSelect === 'Otra' && <Input value={form.classCustom} onChange={(e) => set({ classCustom: e.target.value })} placeholder="Escribe tu clase" />}
                      <Field label="Rol habitual a bordo"><Select value={form.roleSelect} onChange={(e) => set({ roleSelect: e.target.value })}><option value="">Sin especificar</option>{CREW_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}</Select></Field>
                      {form.roleSelect === 'Otro' && <Input value={form.roleCustom} onChange={(e) => set({ roleCustom: e.target.value })} placeholder="Escribe tu rol" />}
                      <LocationPicker value={{ country: form.country, city: form.city }} onChange={({ country, city }) => set({ country, city })} cityLabel="Ciudad / zona" />
                    </fieldset>

                    <fieldset className="flex flex-col gap-4 border-t border-navy-100 pt-4">
                      <legend className="text-sm font-bold text-navy-900">Redes y contacto</legend>
                      <Field label="Instagram" error={instagramError}>
                        <div className={`flex items-center rounded-lg border px-3 focus-within:ring-2 ${instagramError ? 'border-red-300 focus-within:ring-red-200' : 'border-navy-200 focus-within:border-navy-500 focus-within:ring-navy-200'}`}>
                          <span className="text-base text-navy-400">@</span>
                          <input value={form.instagram} onChange={(e) => { const v = e.target.value.replace(/^@/, ''); set({ instagram: v }); setInstagramError(v && !INSTAGRAM_RE.test(v) ? 'Handle inválido' : ''); }} className="w-full bg-transparent py-2.5 pl-0.5 text-base outline-none" placeholder="juan.navega" autoCapitalize="none" autoCorrect="off" />
                        </div>
                      </Field>
                      <Field label="Facebook"><Input value={form.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="facebook.com/tu.pagina" /></Field>
                      <Field label="YouTube"><Input value={form.youtube} onChange={(e) => set({ youtube: e.target.value })} placeholder="@tucanal" /></Field>
                      <Field label="Sitio web" error={websiteError}>
                        <input type="url" value={form.website} onChange={(e) => { const v = e.target.value; set({ website: v }); setWebsiteError(v.trim() && !isHttpUrl(v.trim()) ? 'Debe empezar con http:// o https://' : ''); }} className={controlClasses} placeholder="https://tusitio.com" />
                      </Field>
                    </fieldset>

                    <div className="flex gap-3">
                      <Button type="submit" disabled={saving || uploadingAvatar} fullWidth>{saving ? 'Guardando…' : 'Guardar'}</Button>
                      <Button type="button" variant="secondary" fullWidth onClick={() => { setEditing(false); setUsernameError(''); setWebsiteError(''); setInstagramError(''); }}>Cancelar</Button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              /* ─── VIEW MODE: header compacto tipo LinkedIn ─── */
              <div className="px-5 pb-5">
                <div className="-mt-12 flex flex-col items-center text-center">
                  <button
                    type="button"
                    onClick={() => { startEditing(); fileInputRef.current?.click(); }}
                    className="relative rounded-full ring-2 ring-navy-300 ring-offset-2 cursor-pointer"
                    aria-label="Cambiar foto de perfil"
                  >
                    <Avatar src={avatarShown} name={shown.username} className="h-20 w-20 border-4 border-white text-xl" />
                    <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-navy-800 text-white text-[10px] shadow">📷</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleAvatarSelected(e.target.files?.[0] ?? null)} />

                  <h1 className="mt-3 flex items-center gap-1.5 text-lg font-bold text-navy-950">
                    {shown.name || shown.username}
                    {shown.verified_badge && <VerifiedBadge />}
                  </h1>
                  <Username username={shown.username} className="text-sm text-navy-500" />
                  {summary?.headline && (
                    <p className="mt-1 text-sm font-semibold text-navy-700">{summary.headline}</p>
                  )}

                  {formatLocation(shown.city, shown.country) && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-navy-500">
                      <MapPin className="h-3 w-3" />
                      {formatLocation(shown.city, shown.country)}
                    </p>
                  )}

                  {shown.created_at && (
                    <p className="mt-0.5 text-xs text-navy-400">
                      {formatMembership(shown.created_at)} a bordo
                    </p>
                  )}

                  {shown.sailor_rank && <RankBadge rank={shown.sailor_rank} />}
                </div>

                {/* Stats inline tipo LinkedIn "X conexiones" */}
                {stats && (
                  <div className="mt-4 flex justify-center gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-navy-900">{stats.boats_owned}</p>
                      <p className="text-[11px] text-navy-400">Barcos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-navy-900">{stats.crews_joined}</p>
                      <p className="text-[11px] text-navy-400">Tripulaciones</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-navy-900">{profile?.credentials?.length ?? 0}</p>
                      <p className="text-[11px] text-navy-400">Títulos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-navy-900">{profile?.achievements?.length ?? 0}</p>
                      <p className="text-[11px] text-navy-400">Regatas</p>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <Button onClick={startEditing} fullWidth>Editar perfil</Button>
                  <CvActions profile={shown} isOwner />
                </div>

                {/* Datos náuticos compactos */}
                <NauticalData profile={shown} />

                {/* Disponibilidad / especialidades */}
                {summary && (
                  <div className="mt-4 border-t border-navy-100 pt-4">
                    <CvSpecialties summary={summary} />
                  </div>
                )}

                {/* Redes sociales */}
                <SocialLinks profile={shown} />
              </div>
            )}
          </Card>

          {/* Card de completar perfil (solo si no está editando) */}
          {!editing && profile && <div className="mt-5"><ProfileCompleteness profile={profile} /></div>}
        </div>

        {/* ─── Columna derecha: secciones del CV (About, Stats, Credenciales, Logros, Barcos) ─── */}
        {!editing && (
          <div className="mt-6 flex flex-col gap-8 lg:mt-0">
            <NauticalIdentity userId={shown.id} isOwner />
            <CvPanel
              profile={shown}
              isOwner
              onRefresh={reloadProfile}
              boats={boatsSection}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}