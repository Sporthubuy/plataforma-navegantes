/**
 * Renderiza un username con el @ adelante (los usernames se guardan
 * sin @ — el @ es solo presentación).
 */
export function Username({
  username,
  className = '',
}: {
  username: string | null | undefined;
  className?: string;
}) {
  if (!username) return null;
  return (
    <span className={`font-medium text-navy-500 ${className}`}>
      <span className="opacity-70">@</span>
      {username}
    </span>
  );
}
