/** Íconos de navegación compartidos por la bottom-nav y el sidebar. */

type IconProps = { active?: boolean; className?: string };

export function HomeIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1v-9.5Z"
      />
    </svg>
  );
}

export function BoatIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v13m0-13c4 3.5 5.5 7 5.5 13H12m0-13C9 6 8 9 8 16h4M3 19c1.5 1.5 4 1.5 5.5 0 1.5 1.5 5.5 1.5 7 0 1.5 1.5 4 1.5 5.5 0"
      />
    </svg>
  );
}

export function BellIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 9a6 6 0 1 1 12 0c0 3 .8 4.8 1.6 6 .4.6 0 1.5-.8 1.5H5.2c-.8 0-1.2-.9-.8-1.5C5.2 13.8 6 12 6 9Zm4 10a2 2 0 0 0 4 0"
      />
    </svg>
  );
}

export function FlagIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 21V4m0 1.5 3.5-1.5c2 -.8 4 .8 6 0l4-1.7v9l-4 1.7c-2 .8-4-.8-6 0L5 13.5"
      />
    </svg>
  );
}

export function ShieldIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5-4-1.2-7-5.1-7-9.5V6l7-3Z"
      />
    </svg>
  );
}

export function AnchorIcon({ active, className = 'h-6 w-6' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.4 : 1.8}
    >
      <circle cx="12" cy="5" r="2.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 7.5V21m0 0c-4.5 0-8-3-8.5-7M12 21c4.5 0 8-3 8.5-7M2 12.5 3.5 14M22 12.5 20.5 14M9 10.5h6"
      />
    </svg>
  );
}
