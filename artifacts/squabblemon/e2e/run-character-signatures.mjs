import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const frontend=fileURLToPath(new URL('../',import.meta.url));const origin='http://127.0.0.1:43248';
const env={...process.env,PORT:'43248',BASE_PATH:'/',VITE_E2E_AUTH:'true',UI_ORIGIN:origin};
const server=spawn(process.execPath,[frontend+'/node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',env.PORT,'--strictPort'],{cwd:frontend,env,stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',d=>{output=(output+d).slice(-8000)});server.stderr.on('data',d=>{output=(output+d).slice(-8000)});
let check;const timeout=setTimeout(()=>{check?.kill('SIGTERM');server.kill('SIGTERM')},300000);
try{let ready=false;for(let n=0;n<150;n++){assert.equal(server.exitCode,null,output);try{if((await fetch(origin+'/e2e/character-signatures.fixture.html')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready,output);
 check=spawn(process.execPath,[fileURLToPath(new URL('./verify-character-signatures.mjs',import.meta.url))],{cwd:frontend,env,stdio:'inherit'});const code=await new Promise((resolve,reject)=>{check.once('error',reject);check.once('exit',resolve)});assert.equal(code,0);
}finally{clearTimeout(timeout);check?.kill('SIGTERM');server.kill('SIGTERM');}
