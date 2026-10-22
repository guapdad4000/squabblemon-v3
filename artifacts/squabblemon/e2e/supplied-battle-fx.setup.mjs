import { fileURLToPath } from 'node:url';

// Load the repository's CSS/Vite-environment hooks, then resolve this checkout's
// current API and engine sources instead of another worktree's linked packages.
await import('../../../scripts/battle-test-css.mjs');
process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../tsconfig.supplied-fx.json', import.meta.url));
await import('tsx/esm');
