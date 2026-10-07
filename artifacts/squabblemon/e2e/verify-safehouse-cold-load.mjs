import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4195';
const label = process.env.PERF_LABEL ?? 'after';
const samples = Number(process.env.PERF_SAMPLES ?? 3);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const results = [];
try {
  for(let i=0;i<samples;i++) {
    const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
    await context.addInitScript(() => {
      window.pendingSceneImages=0;
      const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
      Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){
        window.pendingSceneImages++;
        let finished=false;
        const finish=()=>{if(!finished){finished=true;window.pendingSceneImages--;this.removeEventListener('load',finish);this.removeEventListener('error',finish);}};
        this.addEventListener('load',finish);this.addEventListener('error',finish);
        descriptor.set.call(this,value);
      }});
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:500000,uploadThroughput:125000});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    // The real scene and its asset graph, embedded like Home, isolated from dev-server JS and authentication.
    const host=origin+'/safehouse-loading-test.html';
    await page.route(host,r=>r.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#090909}iframe{display:block;width:100vw;height:100vh;border:0}</style><iframe src="/scenes/safehouse/index.html?gpuTier=medium"></iframe>'}));
    const start=Date.now();
    await page.goto(host,{waitUntil:'domcontentloaded'});
    await page.waitForEvent('framenavigated',{predicate:f=>f.url().includes('/scenes/safehouse/'),timeout:30000});
    const frame=page.frames().find(f=>f.url().includes('/scenes/safehouse/'));
    assert.ok(frame);
    await frame.waitForFunction(()=>window.Squabblemon?.getSceneStatus?.().drawCalls>0&&!document.querySelector('#loading'),{},{timeout:90000});
    const firstFrameMs=Date.now()-start;
    await frame.waitForFunction(()=>window.pendingSceneImages===0,{},{timeout:90000});
    const artLoadedMs=Date.now()-start;
    await page.waitForTimeout(700);
    const status=await frame.evaluate(()=>window.Squabblemon.getSceneStatus());
    assert.ok(status.triangles>0);
    const resources=await frame.evaluate(()=>performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.encodedBodySize,start:r.startTime,end:r.responseEnd})));
    const boardResources=resources.filter(r=>r.url.includes('/assets/events/supplied/'));
    assert.equal(boardResources.length,6);
    assert.deepEqual(errors,[]);
    await mkdir('screenshots/safehouse-performance',{recursive:true});
    await page.screenshot({path:`screenshots/safehouse-performance/cold-${label}-phone-${i+1}.png`});
    const result={sample:i+1,firstFrameMs,artLoadedMs,boardBytes:boardResources.reduce((sum,r)=>sum+r.bytes,0),totalResourceBytes:resources.reduce((sum,r)=>sum+r.bytes,0),drawCalls:status.drawCalls,triangles:status.triangles,resources};
    results.push(result);
    console.log(JSON.stringify({...result,resources:undefined}));
    await context.close();
  }
  await writeFile(`/tmp/safehouse-cold-${label}.json`,JSON.stringify(results,null,2));
} finally {await browser.close();}
