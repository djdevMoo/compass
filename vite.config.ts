import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  // Relative asset paths so the built app loads from disk (file://) inside Electron.
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/electron/**', '**/release/**'] },
  },
  build: {
    target: 'chrome140',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
