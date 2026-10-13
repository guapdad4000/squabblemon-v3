import { mergeConfig } from 'vite';
import path from 'node:path';
import config from './vite.config';
export default mergeConfig(config, { build: { copyPublicDir: false, outDir: path.resolve(import.meta.dirname, '../deliverables/player-notes-20261012/build') } });
