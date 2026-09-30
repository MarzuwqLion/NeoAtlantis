import { defineConfig } from 'vite';

// Static build: relative base so dist/ can be hosted from any path.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2500,
  },
  server: {
    port: 5173,
  },
});
