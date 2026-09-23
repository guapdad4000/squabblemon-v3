import { mergeConfig, type Plugin } from 'vite';
import appConfig from '../vite.config';

// This transform is deliberately confined to the Fadecade production test build.
// It enables the same disposable provider as the fighter-id browser suite without
// changing the application's normal development or production authentication.
const disposableAuth: Plugin = {
  name: 'fadecade-disposable-auth',
  enforce: 'pre',
  transform(source, id) {
    if (!id.split('?')[0].endsWith('/src/lib/auth.tsx')) return;
    const guard = "import.meta.env.DEV && import.meta.env.VITE_E2E_AUTH === 'true'";
    if (!source.includes(guard)) {
      throw new Error('Disposable auth guard changed; update the Fadecade test harness.');
    }
    return source.replace(guard, 'true');
  },
};

export default mergeConfig(appConfig, {
  cacheDir: 'node_modules/.vite-fadecade',
  plugins: [disposableAuth],
  build: {
    outDir: 'dist/fadecade-test',
    emptyOutDir: true,
  },
});