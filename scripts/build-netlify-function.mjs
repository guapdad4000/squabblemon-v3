import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Ship one JavaScript module per function: Netlify's Windows TypeScript
// tracing otherwise emits multiple source modules under the same archive path.
// deploy-succeeded.mjs is the post-deploy store smoke check; it must ship
// alongside the API bundle or the release gate (check-netlify-function.mjs)
// fails the build.
await build({
  absWorkingDir: root,
  entryPoints: [
    'artifacts/api-server/src/netlify/functions/api.mts',
    'artifacts/api-server/src/netlify/functions/deploy-succeeded.mts',
  ],
  outdir: 'artifacts/api-server/dist/netlify-functions',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  external: ['pg-native'],
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  alias: {
    '@workspace/db': path.join(root, 'lib/db/src/index.ts'),
    '@workspace/api-zod': path.join(root, 'lib/api-zod/src/index.ts'),
    '@workspace/squabblemon-engine': path.join(root, 'lib/squabblemon-engine/src'),
  },
  logLevel: 'info',
});
