import { fileURLToPath } from 'node:url';
process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('./battle-tests.tsconfig.json', import.meta.url));
import { registerHooks } from 'node:module';
const browserSourceRoot = new URL('../artifacts/squabblemon/src/', import.meta.url).href;
// Render-only tests need Vite's environment shape, not browser credentials or
// the development-only authentication bypass. Keep this out of runtime code.
const viteEnvironment = JSON.stringify({
  BASE_URL: '/', DEV: false, PROD: true, MODE: 'test', SSR: true, VITE_E2E_AUTH: 'false',
});
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    const loaded = nextLoad(url, context);
    if (!url.startsWith(browserSourceRoot) || !loaded.source ||
        !['module', 'module-typescript'].includes(loaded.format)) return loaded;
    const source = typeof loaded.source === 'string' ? loaded.source : Buffer.from(loaded.source).toString('utf8');
    return source.includes('import.meta.env')
      ? { ...loaded, source: `import.meta.env = Object.freeze(${viteEnvironment});\n${source}` }
      : loaded;
  },
});
