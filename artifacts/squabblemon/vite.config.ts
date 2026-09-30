import path from 'path';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

function resolvePublicOrigin() {
  const configuredOrigin = process.env.PUBLIC_ORIGIN?.trim();
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';

  if (!configuredOrigin) {
    if (isDeployment) {
      throw new Error(
        'PUBLIC_ORIGIN is required when publishing Squabblemon (for example, https://squabblemon.example).',
      );
    }

    return `http://localhost:${port}`;
  }

  const url = new URL(configuredOrigin);
  const normalizedInput = configuredOrigin.replace(/\/$/, '');

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== normalizedInput
  ) {
    throw new Error(
      'PUBLIC_ORIGIN must be an HTTP(S) origin without a path, query, or hash.',
    );
  }

  if (isDeployment && url.protocol !== 'https:') {
    throw new Error('PUBLIC_ORIGIN must use HTTPS when publishing.');
  }

  return url.origin;
}

const publicOrigin = resolvePublicOrigin();
const publicPageUrl = new URL(basePath, `${publicOrigin}/`).href;
const publicImageUrl = new URL(
  `${basePath.replace(/\/$/, '')}/brand/squabblemon-standard-gold-share.jpg`,
  `${publicOrigin}/`,
).href;

function bundleBudgetReport(): Plugin {
  return {
    name: 'squabblemon-bundle-budget-report',
    apply: 'build',
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle)
        .filter((output) => output.type === 'chunk')
        .map((chunk) => ({
          fileName: chunk.fileName,
          facadeModuleId: chunk.facadeModuleId,
          isEntry: chunk.isEntry,
          imports: chunk.imports,
          dynamicImports: chunk.dynamicImports,
          modules: Object.keys(chunk.modules),
          bytes: Buffer.byteLength(chunk.code),
        }));

      this.emitFile({
        type: 'asset',
        fileName: 'bundle-budget-report.json',
        source: JSON.stringify({ chunks }, null, 2),
      });
    },
  };
}

/** Error documents can be returned at deep missing-asset URLs, so relative
 * image links cannot be resolved against the browser's current directory. */
function brandedNotFoundPage(): Plugin {
  let assetBase = '/';
  const render = () => readFileSync(path.resolve(import.meta.dirname, 'public/404.html'), 'utf8')
    .replaceAll('__SQUABBLEMON_ASSET_BASE__', assetBase);
  return {
    name: 'squabblemon-branded-not-found',
    configResolved(config) { assetBase = config.base; },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== `${assetBase}404.html`) return next();
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(render());
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '404.html', source: render() });
    },
  };
}

export default defineConfig({
  // Keep nested preview paths canonical for Vite's public asset rewriting.
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
  // A competing startup can optimize dependencies before failing to bind its port.
  // Never let it (or a test server) replace the React files of a running preview.
  cacheDir: path.resolve(import.meta.dirname, 'node_modules/.vite-runtime', String(process.pid)),
  plugins: [
    {
      name: 'squabblemon-social-metadata',
      transformIndexHtml(html) {
        return html
          .replaceAll('__SQUABBLEMON_PUBLIC_PAGE_URL__', publicPageUrl)
          .replaceAll('__SQUABBLEMON_PUBLIC_IMAGE_URL__', publicImageUrl);
      },
    },
    bundleBudgetReport(),
    brandedNotFoundPage(),
    react(),
    // Minify/optimize CSS for production builds only; dev keeps fast rebuilds.
    tailwindcss({ optimize: process.env.NODE_ENV === 'production' }),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@workspace/api-client-react': path.resolve(import.meta.dirname, '../../lib/api-client-react/src/index.ts'),
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
      ...(process.env.VITE_BATTLE_PERF === '1'
        ? { 'react-dom/client': 'react-dom/profiling' }
        : {}),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, process.env.VITE_BATTLE_PERF === '1' ? 'dist/performance' : 'dist/public'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Engine modules resolve to one module ID each (package exports -> src),
        // so Rollup already ships a single copy split by route. Only stable
        // vendor code gets long-lived chunks.
        manualChunks(id) {
          if (/node_modules\/(?:\.pnpm\/)?(?:react|react-dom|scheduler)[@/]/.test(id)) return 'react';
          if (id.includes('node_modules') && /framer-motion|motion-dom|motion-utils/.test(id)) return 'motion';
        },
      },
    },
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
