import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function releaseEnvironment(source) {
  const publishable = source.VITE_CLERK_PUBLISHABLE_KEY?.trim();
  if (!publishable?.match(/^pk_(live|test)_/)) throw new Error('Configure VITE_CLERK_PUBLISHABLE_KEY before publishing. Test-auth preview builds are not a release.');
  const origin = source.PUBLIC_ORIGIN || source.DEPLOY_PRIME_URL || source.URL;
  if (!origin) throw new Error('Configure the public HTTPS site origin before publishing.');
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin.replace(/\/$/,'')) throw new Error('PUBLIC_ORIGIN must be an HTTPS origin with no path.');
  return {...source, PORT:'5173',BASE_PATH:'/',NODE_ENV:'production',VITE_E2E_AUTH:'false',PUBLIC_ORIGIN:url.origin};
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
  run(['scripts/build-netlify-function.mjs'],env);
  run(['scripts/check-netlify-function.mjs'],env);
  run(['node_modules/vite/bin/vite.js','build','--config','artifacts/squabblemon/vite.config.ts'],env);
  run(['scripts/check-entry-bundle.mjs'],env,'artifacts/squabblemon');
}
