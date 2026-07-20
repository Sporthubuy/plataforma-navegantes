import type { ProfileStats, User } from '@/lib/types';

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

export function NauticalData({ profile }: { profile: User }) {
  const rows = [
    { icon: <ClubIcon />, value: profile.club },
    { icon: <ClassIcon />, value: profile.sailing_class },
    { icon: <RoleIcon />, value: profile.usual_role },
    { icon: <LocationIcon />, value: profile.location },
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
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-sm">
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
