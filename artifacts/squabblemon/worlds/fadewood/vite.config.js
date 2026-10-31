import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  base: './', publicDir: false,
  cacheDir: '/tmp/fadewood-vite-cache',
  build: { outDir: resolve(root, '../../public/scenes/fadewood'), emptyOutDir: false,
    target: 'es2022', chunkSizeWarningLimit: 750,
    rollupOptions: { input: resolve(root, 'integrated.html'), output: { manualChunks(id) { if (id.includes('/node_modules/three/')) return 'three'; } } },
  },
});
