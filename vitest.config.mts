import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  test: {
    // Por defecto, tests de dominio puro corren en node (más rápido).
    // Los tests de UI marcarán // @vitest-environment jsdom al inicio.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.mts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});