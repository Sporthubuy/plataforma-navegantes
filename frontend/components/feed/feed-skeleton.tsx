/** Placeholders con shimmer mientras carga el feed. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-navy-100 bg-white px-4 py-3 md:px-5"
        >
          {/* Layout Twitter/X: avatar izq + col der */}
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-navy-100" />
            <div className="flex-1 space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-28 rounded bg-navy-100" />
                <div className="h-3 w-12 rounded bg-navy-50" />
                <div className="h-2 w-6 rounded bg-navy-50" />
              </div>
              {/* Body */}
              <div className="h-3.5 w-3/4 rounded bg-navy-50" />
              <div className="h-3 w-full rounded bg-navy-50" />
              <div className="h-3 w-5/6 rounded bg-navy-50" />
              {/* Action bar */}
              <div className="pt-2 flex gap-4">
                <div className="h-5 w-10 rounded bg-navy-50" />
                <div className="h-5 w-10 rounded bg-navy-50" />
                <div className="h-5 w-10 rounded bg-navy-50" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}