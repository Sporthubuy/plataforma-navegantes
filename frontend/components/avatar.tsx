/**
 * Avatar circular: muestra la foto o la inicial del username.
 * Dimensiona con className (ej: "h-10 w-10 text-base").
 */
export function Avatar({
  src,
  name,
  className = 'h-10 w-10 text-base',
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full border border-navy-100 object-cover ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-navy-800 font-bold text-white ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
