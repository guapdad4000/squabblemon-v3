import { chromium } from '@playwright/test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
const stem = 'e2e/mechanic-voice.generated';
const cues = JSON.parse(await readFile('reference/dr-fade-mechanic-audio.json','utf8')).clips;
const fixture = (await readFile('e2e/rookie-road.fixture.tsx','utf8'))
 .replace('getTutorialGuidance }', 'getTutorialGuidance, MECHANIC_LESSONS }')
 .replace("  const [selected,", "  const [lesson, setLesson] = useState(() => MECHANIC_LESSONS[new URLSearchParams(location.search).get('lesson') as keyof typeof MECHANIC_LESSONS]);\n  const [selected,")
 .replace('<Battle tutorialCoach tutorialGuidance={guidance}', '<Battle tutorialCoach mechanicLesson={lesson} onDismissMechanicLesson={() => setLesson(undefined!)}');
await writeFile(stem+'.tsx',fixture);
await writeFile(stem+'.html','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="./mechanic-voice.generated.tsx"></script></body></html>');
const browser = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
try {
 for(const ext of ['ogg','m4a']) {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'isolated fixture'}}));
  await page.addInitScript(ext=>{
   window.__clips=[];
   if(ext==='m4a'){const can=HTMLMediaElement.prototype.canPlayType;HTMLMediaElement.prototype.canPlayType=function(type){return type.includes('vorbis')?'':can.call(this,type)}}
   const Native=window.Audio;window.Audio=class extends Native {constructor(src){super(src);if(src?.includes('/dr-fade/tutorial/'))window.__clips.push(this)}};
  },ext);
  for(const cue of cues){
   await page.goto(`${origin}/${stem}.html?lesson=${cue.id.replace('mechanic-','')}`);
   await page.waitForFunction(name=>window.__clips.some(a=>a.src.includes(name)&&!a.paused&&a.currentTime>.1&&a.readyState>=2),`${cue.id}.${ext}`);
   assert.equal(await page.evaluate(()=>window.__clips.filter(a=>!a.paused).length),1);
   await page.getByTestId('button-dismiss-mechanic-lesson').click();
   await page.waitForFunction(()=>window.__clips.every(a=>a.paused));
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('20 mechanic clips played in real overlays; both formats; dismissal stops playback; no runtime errors.');
} finally {await browser.close();await unlink(stem+'.tsx');await unlink(stem+'.html')}
