'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#14263d', color: '#f2f6fa' },
        }}
      />
    </AuthProvider>
  );
}
