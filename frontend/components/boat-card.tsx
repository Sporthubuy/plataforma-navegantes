import Link from 'next/link';
import type { MyBoat } from '@/lib/types';

export function BoatCard({ boat }: { boat: MyBoat }) {
  return (
    <Link
      href={`/boats/${boat.id}`}
      className="flex h-full items-center gap-4 rounded-xl border border-navy-100 bg-white p-4 transition hover:border-navy-200"
    >
      {boat.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={boat.photo_url}
          alt={boat.name}
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-navy-100 text-2xl">
          ⛵
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-navy-900">{boat.name}</p>
        <p className="truncate text-sm text-navy-500">
          {boat.category}
          {boat.sail_number ? ` · ${boat.sail_number}` : ''}
        </p>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            boat.relation === 'owner'
              ? 'bg-navy-800 text-white'
              : 'bg-navy-100 text-navy-700'
          }`}
        >
          {boat.relation === 'owner'
            ? 'Dueño'
            : `Tripulante${boat.my_role ? ` · ${boat.my_role}` : ''}`}
        </span>
      </div>
      <span className="text-navy-300">›</span>
    </Link>
  );
}
