import { formatLocation } from '@/lib/geo';
import { ageFrom, formatBirthDate } from '@/lib/format';
import type { ProfileStats, SailorRank, User } from '@/lib/types';
import { SAILOR_RANK_LABEL, type SailorRankName } from '@/lib/types';

// ── Constructores de URL pública a partir del dato crudo ────────────

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, '')}`;
}

/** Facebook/YouTube pueden venir como URL o handle. */
function urlOrHandle(value: string, base: string): string {
  return /^https?:\/\//i.test(value) ? value : `${base}${value.replace(/^@/, '')}`;
}
export function facebookUrl(value: string): string {
  return urlOrHandle(value, 'https://facebook.com/');
}
export function youtubeUrl(value: string): string {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://youtube.com/${value.startsWith('@') ? value : `@${value}`}`;
}

// ── Antigüedad legible ──────────────────────────────────────────────

export function formatMembership(iso: string): string {
  const months = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.4))
  );
  if (months < 1) return 'recién llegado';
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'año' : 'años'}`;
}

// ── Íconos ──────────────────────────────────────────────────────────

const ico = 'h-4 w-4 shrink-0 text-navy-400';

function ClubIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21V5l8-2 8 2v16M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  );
}
function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14M12 3v18M12 3l7 12H5L12 3Z" />
    </svg>
  );
}
function RoleIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="7" r="3.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ico} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

const socialIco = 'h-5 w-5';
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className={socialIco} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className={socialIco} fill="currentColor">
      <path d="M13.5 21v-7h2.3l.4-2.7h-2.7V9.5c0-.8.2-1.3 1.4-1.3h1.4V5.8c-.7-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2H8.3V14h2.3v7h2.9Z" />
    </svg>
  );
}
function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className={socialIco} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="6" width="18" height="12" rx="3" />
      <path d="M11 9.5v5l4-2.5-4-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function WebIcon() {
  return (
    <svg viewBox="0 0 24 24" className={socialIco} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

// ── Datos náuticos (solo los que tienen valor) ──────────────────────

function BirthdayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-navy-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
      <path d="M4 15a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0v-2a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2Z" />
      <path d="M12 8V6M9 8V6.5M15 8V6.5" />
    </svg>
  );
}

export function NauticalData({ profile }: { profile: User }) {
  const rows = [
    { icon: <ClubIcon />, value: profile.club?.name ?? null },
    { icon: <ClassIcon />, value: profile.sailing_class },
    { icon: <RoleIcon />, value: profile.usual_role },
    { icon: <LocationIcon />, value: formatLocation(profile.city, profile.country) },
    // La edad acompaña a la fecha: es lo que se lee de un vistazo.
    {
      icon: <BirthdayIcon />,
      value: profile.birth_date
        ? `${formatBirthDate(profile.birth_date)}${
            ageFrom(profile.birth_date) !== null
              ? ` · ${ageFrom(profile.birth_date)} años`
              : ''
          }`
        : null,
    },
  ].filter((r) => r.value);

  if (rows.length === 0) return null;

  return (
    <dl className="mt-4 flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-navy-700">
          {r.icon}
          <span className="min-w-0 truncate">{r.value}</span>
        </div>
      ))}
    </dl>
  );
}

// ── Fila de redes (solo las cargadas) ───────────────────────────────

export function SocialLinks({ profile }: { profile: User }) {
  const links = [
    profile.instagram && { href: instagramUrl(profile.instagram), icon: <InstagramIcon />, label: 'Instagram' },
    profile.facebook && { href: facebookUrl(profile.facebook), icon: <FacebookIcon />, label: 'Facebook' },
    profile.youtube && { href: youtubeUrl(profile.youtube), icon: <YoutubeIcon />, label: 'YouTube' },
    profile.website && { href: profile.website, icon: <WebIcon />, label: 'Sitio web' },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

  if (links.length === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-center gap-2 lg:justify-start">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          title={l.label}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-navy-200 text-navy-600 transition hover:bg-navy-50 hover:text-navy-800"
        >
          {l.icon}
        </a>
      ))}
    </div>
  );
}

// ── Franja de estadísticas ──────────────────────────────────────────

function StatTile({
  value,
  label,
  small = false,
}: {
  value: string | number;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-navy-100 bg-white p-4 text-center">
      <p
        className={`font-bold text-navy-900 ${
          small ? 'text-base md:text-lg' : 'text-2xl md:text-3xl'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-navy-500">{label}</p>
    </div>
  );
}

export function StatsStrip({ stats }: { stats: ProfileStats | null }) {
  if (!stats) return null;
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile value={stats.boats_owned} label="Barcos" />
      <StatTile value={stats.crews_joined} label="Tripulaciones" />
      <StatTile value={formatMembership(stats.member_since)} label="a bordo" small />
    </div>
  );
}

// ── Rango de gamificación ─────────────────────────────────

const RANK_COLORS: Record<SailorRankName, { bg: string; text: string; dot: string }> = {
  apprentice: { bg: 'bg-navy-100', text: 'text-navy-600', dot: 'bg-navy-400' },
  sailor: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  helmsman: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  master: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  captain: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
};

export function RankBadge({ rank }: { rank: SailorRank | null }) {
  if (!rank) return null;
  const colors = RANK_COLORS[rank.rank] ?? RANK_COLORS.apprentice;
  return (
    <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 ${colors.bg}`}>
      <span className={`h-2 w-2 rounded-full ${rank.is_active ? colors.dot : 'bg-navy-300'}`} />
      <span className={`text-xs font-bold ${colors.text}`}>
        {SAILOR_RANK_LABEL[rank.rank]}
      </span>
      <span className="text-[11px] text-navy-500">
        · {rank.lifetime_hours.toFixed(1)}h
      </span>
    </div>
  );
}
