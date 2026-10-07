import path from 'node:path';
import { mergeConfig } from 'vite';
import appConfig from '../vite.config';

// Compile the actual popup modules with the normal production plugins and
// minifier. No auth transform and no copy of the large public art directory.
export default mergeConfig(appConfig, {
  cacheDir: `/tmp/squabblemon-deferred-popups-vite-${process.pid}`,
  build: {
    outDir: '/tmp/squabblemon-deferred-popups-production',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, 'deferred-popups.fixture.html'),
    },
  },
});
