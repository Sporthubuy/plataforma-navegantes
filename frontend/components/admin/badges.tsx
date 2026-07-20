import { ACCOUNT_TYPE_LABEL } from '@/lib/format';
import type { AccountStatus, AccountType } from '@/lib/types';

export function StatusBadge({ status }: { status: AccountStatus }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-red-500'
        }`}
      />
      {active ? 'Activo' : 'Suspendido'}
    </span>
  );
}

export function AccountTypeBadge({ type }: { type: AccountType }) {
  const styles: Record<AccountType, string> = {
    sailor: 'bg-navy-100 text-navy-700',
    club: 'bg-amber-100 text-amber-800',
    federation: 'bg-violet-100 text-violet-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[type]}`}
    >
      {ACCOUNT_TYPE_LABEL[type] ?? type}
    </span>
  );
}
