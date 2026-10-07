import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { assertSpriteArt } from './motion-sprite-proof';
const base=process.env.ARCADE_BASE_URL??'http://127.0.0.1:4231';
const out=process.env.REVIEW_OUTPUT??'../../screenshots/minigame-motion';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(`${base}/e2e/minigame-motion.fixture.html`);
 await page.locator('.motion-sprite[data-motion-ready="true"]').first().waitFor();
 await assertSpriteArt(page);
 const rowIsolation = await page.locator('[data-sprite="girl-0-front-jab-left"] svg').evaluate(async svg => {
  const original = svg.querySelector('image')!;
  const atlas = await fetch(original.getAttribute('href')!).then(response => response.blob());
  const embedded = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(atlas); });
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '160'); clone.setAttribute('height', '240');
  const frame = clone.querySelector('image')!;
  frame.setAttribute('href', embedded); frame.removeAttribute('class');
  frame.setAttribute('style', `transform:${getComputedStyle(original).transform}`);
  const rendered = new Image(); rendered.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`; await rendered.decode();
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 240;
  const context = canvas.getContext('2d')!; context.drawImage(rendered, 0, 0);
  const pixels = context.getImageData(0, 0, 160, 240).data; let leaked = 0, body = 0;
  for(let y=0;y<240;y++)for(let x=0;x<160;x++)if(pixels[(y*160+x)*4+3]>32){body++;if(y<40||y>=200)leaked++;}
  return { leaked, body };
 });
 assert.ok(rowIsolation.body > 500, 'Selected action art renders');
 assert.equal(rowIsolation.leaked, 0, 'Tall sprite containers never expose neighboring atlas rows');
 const report=JSON.parse(await readFile('../../design/minigame-motion/atlas-report.json','utf8'));
 const frameCount=report.reduce((n:number,a:{frames?:unknown[]})=>n+(a.frames?.length??0),0);assert.equal(frameCount,220);
 const atlasChecks=await page.evaluate(async assets=>{
  const results=[];
  for(const a of assets.filter((a:{frames?:unknown[]})=>a.frames)){
   const img=new Image();img.src=`/assets/minigames/motion-v1/${a.key}.webp`;await img.decode();
   const canvas=document.createElement('canvas');canvas.width=a.cellWidth;canvas.height=a.cellHeight;const ctx=canvas.getContext('2d')!;
   for(let row=0;row<a.rows;row++){
    const signatures=new Set<string>();
    for(let frame=0;frame<4;frame++){
     ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,frame*a.cellWidth,row*a.cellHeight,a.cellWidth,a.cellHeight,0,0,a.cellWidth,a.cellHeight);
     const p=ctx.getImageData(0,0,canvas.width,canvas.height).data;let body=0,border=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){if(p[(y*canvas.width+x)*4+3]>32){body++;if(x<2||y<2||x>=canvas.width-2||y>=canvas.height-2)border++;}}
     if(border||body<canvas.width*canvas.height*.02)throw Error(`${a.key}/${row}/${frame}: clipped or blank`);
     signatures.add(canvas.toDataURL());
    }
    if(signatures.size<3)throw Error(`${a.key}/${row}: repeated static pose`);results.push(`${a.key}:${row}`);
   }
  }return results.length;
 },report);
 const actor=page.locator('[data-sprite="girl-0-front"]');await actor.scrollIntoViewIfNeeded();
 const samples=new Set<string>();const read=()=>actor.locator('image').evaluate(el=>getComputedStyle(el).transform);
 await page.waitForTimeout(150);const commits=await page.evaluate(()=>(window as unknown as {__spriteCommits:number}).__spriteCommits);
 for(let i=0;i<9;i++){samples.add(await read());await page.waitForTimeout(180);}
 assert.ok(samples.size>=3,'Idle traverses distinct art frames');assert.equal(await page.evaluate(()=>(window as unknown as {__spriteCommits:number}).__spriteCommits),commits,'CSS playback produces no React render ticks');
 await page.getByRole('button',{name:'Pause sprites'}).click();const paused=await read();await page.waitForTimeout(450);assert.equal(await read(),paused,'Pause holds current pose');
 await page.getByRole('button',{name:'Pause sprites'}).click();
 await page.getByRole('button',{name:'Reduced motion'}).click();await page.waitForTimeout(50);const still=await read();await page.waitForTimeout(450);assert.equal(await read(),still);
 await page.getByRole('button',{name:'Reduced motion'}).click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(50);const mediaStill=await read();await page.waitForTimeout(450);assert.equal(await read(),mediaStill);
 await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(100);assert.equal(await actor.getAttribute('data-motion-visible'),'false');const offscreen=await read();await page.waitForTimeout(450);assert.equal(await read(),offscreen,'Offscreen playback pauses');
 for(const sprite of await page.locator('.motion-sprite').all()){await sprite.scrollIntoViewIfNeeded();await page.waitForTimeout(25);}
 await page.waitForFunction(()=>Array.from(document.querySelectorAll<HTMLElement>('.motion-sprite')).every(el=>el.dataset.motionReady==='true'));
 await page.evaluate(()=>scrollTo(0,0));
 await page.getByRole('button',{name:'Pause sprites'}).click();await page.waitForTimeout(100);
 await page.screenshot({path:`${out}/all-sprites-desktop.png`,fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/all-sprites-phone.png`,fullPage:true});
 await page.getByRole('button',{name:'Pause sprites'}).click();
 assert.deepEqual(errors,[]);const result={frames:frameCount,rows:atlasChecks,distinctPlaybackFrames:samples.size,reactCommitsDuringPlayback:0,paused:true,reducedMotion:true,offscreen:true,isolatedFrameBoundary:true};await writeFile(`${out}/motion-proof.json`,JSON.stringify(result,null,2)+'\n');console.log(result);
} finally {await browser.close();}
