import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    // Los tests no deben tocar la base real: se mockea el cliente Supabase.
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
