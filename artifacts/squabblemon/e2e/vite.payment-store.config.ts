import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: path.resolve(import.meta.dirname, '..'),
  base: '/',
  cacheDir: '/tmp/squabblemon-vite-payment-store-e2e',
  plugins: [react(), tailwindcss({ optimize: false })],
  resolve: {
    alias: {
      '@workspace/api-client-react': path.resolve(import.meta.dirname, '../../../lib/api-client-react/src/index.ts'),
      '@workspace/squabblemon-engine/multiplayer': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/multiplayer.ts'),
      '@workspace/squabblemon-engine/activities': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/activities.ts'),
      '@workspace/squabblemon-engine/career': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/career.ts'),
      '@workspace/squabblemon-engine/insights': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/insights.ts'),
      '@workspace/squabblemon-engine/story': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/story.ts'),
      '@workspace/squabblemon-engine/economy': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/economy.ts'),
      '@workspace/squabblemon-engine/cardProgression': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/cardProgression.ts'),
      '@workspace/squabblemon-engine/abilityUpgrades': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/abilityUpgrades.ts'),
      '@workspace/squabblemon-engine/data': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/data.ts'),
      '@workspace/squabblemon-engine/gameEngine': path.resolve(import.meta.dirname, '../../../lib/squabblemon-engine/src/gameEngine.ts'),
      '@': path.resolve(import.meta.dirname, '../src'),
      '@assets': path.resolve(import.meta.dirname, '../../../attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PAYMENT_E2E_PORT || 4319),
    strictPort: true,
  },
});