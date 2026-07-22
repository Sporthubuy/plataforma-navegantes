/** Placeholders con shimmer mientras carga el feed. */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-navy-100 bg-white p-4 md:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-navy-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 rounded bg-navy-100" />
              <div className="h-2.5 w-20 rounded bg-navy-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-3/4 rounded bg-navy-100" />
            <div className="h-3 w-full rounded bg-navy-100" />
            <div className="h-3 w-5/6 rounded bg-navy-100" />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-12 rounded bg-navy-50" />
            <div className="h-6 w-12 rounded bg-navy-50" />
            <div className="h-6 w-12 rounded bg-navy-50" />
          </div>
        </div>
      ))}
    </div>
  );
}
