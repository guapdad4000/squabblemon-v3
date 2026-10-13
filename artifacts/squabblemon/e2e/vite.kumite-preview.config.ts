import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import gameConfig from '../vite.config';

// Compile review fixtures with the production plugins, avoiding hundreds of raw
// development-module requests during repeated mobile and outcome captures.
export default mergeConfig(gameConfig, {
  build: {
    outDir: process.env.KUMITE_PREVIEW_DIST ?? '/tmp/kumite-preview-dist',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: { input: ['kumite', 'kumite-battle', 'kumite-waiting', 'kumite-rail'].map(name =>
      fileURLToPath(new URL(`./${name}.fixture.html`, import.meta.url))) },
  },
});
