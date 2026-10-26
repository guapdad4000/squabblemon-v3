import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Packages whose module bodies only define values. Declaring them free of side
// effects lets esbuild drop them when nothing uses their exports, while still
// bundling them normally wherever an export is actually used:
// - @netlify/database imports the Neon/WebSocket/waddler clients for
//   getDatabase(); lib/db only calls getConnectionString() and connects via pg.
// - drizzle-zod builds zod helpers at module scope; only the unused, pure
//   `insert*Schema` exports in lib/db reference it.
const sideEffectFreePackages = ['@neondatabase/serverless', 'ws', 'waddler', 'drizzle-zod'];
const packageName = specifier => specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
const sideEffectFree = {
  name: 'side-effect-free-packages',
  setup(pluginBuild) {
    pluginBuild.onResolve({ filter: /^[@a-z]/ }, async args => {
      if (args.pluginData?.sideEffectFree || !sideEffectFreePackages.includes(packageName(args.path))) return undefined;
      const result = await pluginBuild.resolve(args.path, {
        kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: { sideEffectFree: true },
      });
      if (result.errors.length) return { errors: result.errors };
      return { ...result, sideEffects: false };
    });
  },
};

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
    'artifacts/api-server/src/netlify/functions/patch-delivery.mts',
    'artifacts/api-server/src/netlify/functions/kumite-tick.mts',
    'artifacts/api-server/src/netlify/functions/room-retention.mts',
  ],
  outdir: 'artifacts/api-server/dist/netlify-functions',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // Smaller modules parse faster on cold start. keepNames preserves
  // function/class names that dependencies read at runtime (Stripe error
  // `type`, pino's serialized `err.type`) and keeps stack frames readable.
  minify: true,
  keepNames: true,
  treeShaking: true,
  legalComments: 'none',
  sourcemap: false,
  plugins: [sideEffectFree],
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
