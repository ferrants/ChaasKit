import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    include: [
      'tests/**/*.test.ts',
      'packages/**/__tests__/**/*.test.ts',
    ],
  },
});
