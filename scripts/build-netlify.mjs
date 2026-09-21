import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const previewContexts = new Set(['deploy-preview', 'branch-deploy', 'staging']);

function httpsOrigin(name, value) {
  if (!value) throw new Error(`Configure ${name} before publishing.`);
  const url = new URL(value);
  const normalized = value.replace(/\/$/, '');
  if (url.protocol !== 'https:' || url.origin !== normalized) {
    throw new Error(`${name} must be an exact HTTPS origin with no path, query, or fragment.`);
  }
  return url.origin;
}

export function deploymentEnvironment(source) {
  const context = source.CONTEXT?.trim();
  if (context === 'production') return 'production';
  if (previewContexts.has(context) || (!context && source.BRANCH === 'staging')) return 'staging';
  if (context) throw new Error(`Unsupported Netlify deploy context: ${context}`);
  if (source.NETLIFY === 'true') throw new Error('Netlify builds must declare CONTEXT.');
  if (source.APP_ENV === 'production' || source.APP_ENV === 'staging') return source.APP_ENV;
  throw new Error('Local release builds must declare APP_ENV=production or APP_ENV=staging.');
}

export function releaseEnvironment(source) {
  const environment = deploymentEnvironment(source);
  const publishable = source.VITE_CLERK_PUBLISHABLE_KEY?.trim();
  const requiredPrefix = environment === 'production' ? 'pk_live_' : 'pk_test_';
  if (!publishable?.startsWith(requiredPrefix)) {
    throw new Error(`${environment} builds require a ${requiredPrefix} Clerk publishable key.`);
  }
  const platformOrigin = environment === 'production'
    ? source.URL
    : source.DEPLOY_PRIME_URL || (source.CONTEXT === 'staging' ? source.URL : undefined);
  const selectedOrigin = source.PUBLIC_ORIGIN || platformOrigin;
  const origin = httpsOrigin('PUBLIC_ORIGIN', selectedOrigin);
  if (platformOrigin && origin !== httpsOrigin('Netlify deploy origin', platformOrigin)) {
    throw new Error('PUBLIC_ORIGIN must exactly match the current Netlify deploy origin.');
  }
  return {
    ...source,
    APP_ENV: environment,
    PORT: '5173',
    BASE_PATH: '/',
    NODE_ENV: 'production',
    VITE_E2E_AUTH: 'false',
    PUBLIC_ORIGIN: origin,
  };
}
function run(args, env, cwd) {
  const result = spawnSync(process.execPath,args,{stdio:'inherit',env,cwd});
  if (result.error) throw result.error;
  if(result.status !== 0) process.exit(result.status ?? 1);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const env = releaseEnvironment(process.env);
  run(['node_modules/typescript/bin/tsc','--build','lib/squabblemon-engine','lib/db','lib/api-zod','lib/api-client-react'],env);
  run(['node_modules/typescript/bin/tsc','-p','artifacts/api-server/tsconfig.json','--noEmit'],env);
  run(['node_modules/typescript/bin/tsc','-p','artifacts/squabblemon/tsconfig.json','--noEmit'],env);
  // Summoner regressions must block publication before the client/API bundles ship.
  run(['--import','./scripts/battle-test-css.mjs','--import',pathToFileURL(createRequire(import.meta.url).resolve('tsx', { paths: [path.resolve('artifacts/squabblemon')] })).href,'--test','--test-name-pattern=battle renders after|summons render|later copy|summon Hands|stewardesses each','artifacts/squabblemon/src/components/Battle.test.tsx'],env);
  // Both human seats and private online projections are release gates.
  run(['scripts/check-online.mjs','artifacts/squabblemon/src/fairytaleWave.test.ts','artifacts/squabblemon/src/characterWave.test.ts','artifacts/squabblemon/src/multiplayer.test.ts','artifacts/squabblemon/src/elementDecks.test.ts','artifacts/squabblemon/src/lightLeaders.test.ts','artifacts/squabblemon/src/buddyFolks.test.ts','artifacts/squabblemon/src/kyle.test.ts','artifacts/squabblemon/src/stockz.test.ts','artifacts/api-server/src/lib/collectionEconomy.test.ts'],env);
  run(['--import',pathToFileURL(createRequire(import.meta.url).resolve('tsx', { paths: [path.resolve('artifacts/api-server')] })).href,'--test','artifacts/api-server/src/lib/cosmetics.test.ts','artifacts/squabblemon/src/cosmeticAssets.test.ts'],{ ...env, DATABASE_URL: '' });
  run(['scripts/build-netlify-function.mjs'],env);
  run(['scripts/check-netlify-function.mjs'],env);
  run(['node_modules/vite/bin/vite.js','build','--config','artifacts/squabblemon/vite.config.ts'],env);
  run(['scripts/check-entry-bundle.mjs'],env,'artifacts/squabblemon');
}
