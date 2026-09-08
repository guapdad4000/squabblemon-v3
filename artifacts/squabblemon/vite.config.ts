import path from 'path';
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
  `${basePath.replace(/\/$/, '')}/brand/squabblemon-share.jpg`,
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

export default defineConfig({
  base: basePath,
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
    react(),
    tailwindcss({ optimize: false }),
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
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
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
