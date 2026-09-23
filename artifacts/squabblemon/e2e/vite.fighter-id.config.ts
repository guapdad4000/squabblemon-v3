import { mergeConfig, type Plugin } from 'vite';
import appConfig from '../vite.config';

// Only this isolated test build enables the existing disposable auth provider.
// All other production branches (including hidden developer controls) stay intact.
const disposableAuth: Plugin = {
  name: 'fighter-id-disposable-auth',
  enforce: 'pre',
  transform(source, id) {
    if (!id.split('?')[0].endsWith('/src/lib/auth.tsx')) return;
    const guard = "import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === 'true'";
    if (!source.includes(guard)) throw new Error('Disposable auth guard changed; update the profile test harness.');
    return source.replace(guard, 'true');
  },
};

export default mergeConfig(appConfig, {
  cacheDir: 'node_modules/.vite-fighter-id',
  plugins: [disposableAuth],
  build: {
    outDir: 'dist/fighter-id-test',
    emptyOutDir: true,
  },
});