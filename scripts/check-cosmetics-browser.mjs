import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
if (process.env.CAMPAIGN_DATABASE_TESTS !== '1' || !process.env.DATABASE_URL || !['127.0.0.1','localhost'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Use pnpm test:cosmetics with the isolated database.');
const env = { ...process.env, ONLINE_E2E: '1', NODE_ENV: 'development', VITE_E2E_AUTH: 'true', PORT: '4196', BASE_PATH: '/', PUBLIC_ORIGIN: 'http://127.0.0.1:4196', DATABASE_POOL_MAX: '1' };
const host = spawn(process.execPath, ['--import',pathToFileURL(require.resolve('tsx', { paths: [process.cwd()+'/artifacts/api-server'] })).href,'artifacts/squabblemon/e2e/online-server.ts'], {env, stdio:['ignore','pipe','pipe']});
let tail='';
host.stdout.on('data', chunk => {tail=(tail+chunk).slice(-8000)});
host.stderr.on('data', chunk => {tail=(tail+chunk).slice(-8000)});
try {
 await new Promise((resolve,reject) => {
  const interval=setInterval(()=>{ if(tail.includes('Online browser test host:')) {clearInterval(interval); clearTimeout(timeout); resolve();}},100);
  const timeout=setTimeout(()=>{clearInterval(interval);reject(new Error('Browser host startup timed out: '+tail));},30000);
  host.once('exit',code=>{clearInterval(interval);clearTimeout(timeout);reject(new Error('Browser host exited '+code+': '+tail));});
  host.once('error',reject);
 });
 const code=await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['artifacts/squabblemon/e2e/verify-cosmetics.mjs'],{env,stdio:'inherit'});
  child.once('error',reject);child.once('exit',resolve);
 });
 if(code!==0)process.exitCode=code??1;
} finally { host.kill(); }
