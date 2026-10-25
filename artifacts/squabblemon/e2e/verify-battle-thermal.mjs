import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.THERMAL_ORIGIN ?? 'http://127.0.0.1:4338';
const output = process.env.THERMAL_OUTPUT ?? '/tmp/battle-thermal-before';
const seconds = Number(process.env.THERMAL_SECONDS ?? 12);
const cases = process.env.THERMAL_CASES?.split(',') ?? ['ten','ten-status','crowded','crowded-status'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', headless: true, args: ['--disable-dev-shm-usage'] });
const results=[];
try {
  for (const name of cases) {
    const context = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true, hasTouch:true, reducedMotion:'no-preference', serviceWorkers:'block' });
    const page=await context.newPage();page.setDefaultTimeout(20000);
    const errors=[];page.on('pageerror', e=>errors.push(e.message));
    const failed=[];page.on('response', r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
    const cdp=await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Performance.enable');await cdp.send('LayerTree.enable');
    let layers=[];cdp.on('LayerTree.layerTreeDidChange',e=>{layers=e.layers??[];});
    const count=name.startsWith('crowded')?24:10;
    await page.goto(`${origin}/?__battle_perf=1&thermal&count=${count}${name.includes('status')?'&status':''}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__battleThermal?.ready);
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(5000);
    if(name.includes('layered'))await page.addStyleTag({content:'.supplied-battle-fx[data-media-animated="true"]{will-change:transform}'});
    if(name.includes('flat'))await page.addStyleTag({content:'.collector-card--combat{perspective:none!important}'});
    if(name.includes('noidle'))await page.addStyleTag({content:'.battle-board-card{animation-play-state:paused!important}'});
    if(name.includes('nodust'))await page.addStyleTag({content:'.battle-venue__atmosphere::after{animation-play-state:paused!important}'});
    if(name.includes('nohint'))await page.addStyleTag({content:'.battle-board-card{will-change:auto!important}'});
    await page.evaluate(()=>window.__battleThermal.reset());
    const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
    const start=await metrics();
    const trace=[];
    const tracing=process.env.THERMAL_TRACE==='1';
    if(tracing){cdp.on('Tracing.dataCollected',e=>trace.push(...e.value));await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline',transferMode:'ReportEvents'});}
    const idle=await page.evaluate(async ({duration, sampleFrames})=>{
      const longTasks=[];const observer=new PerformanceObserver(l=>longTasks.push(...l.getEntries().map(e=>e.duration)));observer.observe({type:'longtask'});
      const frames=[];let prev=performance.now();const until=prev+duration;
      // Continuous RAF sampling wakes the main thread even when CSS can remain on the compositor.
      // Measure passive idle by default; opt into a separate diagnostic frame sample.
      if (sampleFrames) await new Promise(resolve=>{const sample=now=>{frames.push(now-prev);prev=now;now>=until?resolve():requestAnimationFrame(sample);};requestAnimationFrame(sample);});
      else await new Promise(resolve=>setTimeout(resolve, duration));
      observer.disconnect();frames.sort((a,b)=>a-b);
      return {frames:frames.length,p95FrameMs:frames[Math.ceil(frames.length*.95)-1]??null,over34ms:frames.filter(x=>x>34).length,longTasks:longTasks.length,longTaskMs:longTasks.reduce((a,b)=>a+b,0),react:window.__battleThermal.stats()};
    },{duration:seconds*1000,sampleFrames:process.env.THERMAL_SAMPLE_FRAMES==='1'});
    const end=await metrics();
    if(tracing){const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await done;await writeFile(`${output}/${name}-trace.json`,JSON.stringify(trace));}
    const counters={};for(const key of ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'])counters[key]=end[key]-start[key];
    const dom=await page.evaluate(()=>{
      const cards=[...document.querySelectorAll('[data-card-zone="board"]')];
      const active=document.getAnimations().filter(a=>a.playState==='running');
      return {boardCards:cards.length,willChangeCards:cards.filter(x=>getComputedStyle(x).willChange.includes('transform')).length,animations:active.length,infiniteAnimations:active.filter(a=>a.effect?.getTiming().iterations===Infinity).length,
        animatedMedia:document.querySelectorAll('[data-media-animated="true"]').length,domNodes:document.querySelectorAll('*').length,depth:document.documentElement.dataset.depth,
        horizontalOverflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),dpr:devicePixelRatio,pointer:matchMedia('(pointer:coarse)').matches?'coarse':'fine',
        cards:cards.map(n=>({id:n.dataset.instanceId,animation:getComputedStyle(n).animationName,playState:getComputedStyle(n).animationPlayState,willChange:getComputedStyle(n).willChange}))};
    });
    const layerStats={total:layers.length,drawing:layers.filter(x=>x.drawsContent).length,pixelArea:layers.filter(x=>x.drawsContent).reduce((n,x)=>n+x.width*x.height,0)};
    const traceWork={};for(const e of trace){if(e.ph==='X'&&['Paint','RasterTask','UpdateLayoutTree','Layout','Decode Image','ImageDecodeTask','PrePaint'].includes(e.name)){const s=traceWork[e.name]??={count:0,ms:0};s.count++;s.ms+=(e.dur??0)/1000;}}
    await page.screenshot({path:`${output}/${name}.png`});
    const taps=[];
    for(let i=0;i<4;i++){
      const card=page.locator('[data-card-zone="hand"]').nth(i%2);await card.scrollIntoViewIfNeeded();
      await page.evaluate(()=>{window.__thermalTap=null;document.addEventListener('pointerdown',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{window.__thermalTap=performance.now()-start;}));},{once:true,capture:true});});
      await card.tap();await page.waitForFunction(()=>window.__thermalTap!==null);
      taps.push(await page.evaluate(()=>window.__thermalTap));
      assert.equal(await card.getAttribute('aria-pressed'),'true');
    }
    assert.equal(dom.boardCards,count===10?10:72);assert.equal(dom.horizontalOverflow,0);
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    const result={name,seconds,cpuThrottle:4,viewport:[390,844],idle,counters,dom,layerStats,traceWork,tapToTwoFramesMs:taps,heapUsed:end.JSHeapUsedSize,errors,failed};
    results.push(result);console.log(JSON.stringify({...result,dom:{...dom,cards:undefined}}));
    await writeFile(`${output}/report.json`,JSON.stringify(results,null,2));
    await context.close();
  }
}finally{await browser.close();}
