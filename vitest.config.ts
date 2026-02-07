import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        DB: 'D1Database',
      },
    },
    include: ['tests/**/*.test.ts'],
    exclude: [
      'node_modules/',
      'dashboard/',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dashboard/',
        'tests/',
        '*.config.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@/types': '/src/types',
      '@/brokers': '/src/brokers',
      '@/signals': '/src/signals',
      '@/risk': '/src/risk',
      '@/db': '/src/db',
      '@/api': '/src/api',
      '@/config': '/src/config',
      '@/utils': '/src/utils',
    },
  },
});
