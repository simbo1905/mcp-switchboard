import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    alias: {
      $app: '/src/app',
      $lib: '/src/lib'
    }
  },
  define: {
    'process.env.NODE_ENV': '"test"'
  }
});