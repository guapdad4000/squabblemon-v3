import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4288';
const output = process.env.WORLD_OUTPUT ?? '/tmp/fadewood-ui-refinement';
const boothOnly = process.env.WORLD_CASE === 'booth';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const report = [];
// Controlled acknowledgements prove host ownership. This deliberately does not certify camera or GPU rendering.
const child = `<!doctype html><html><body style="margin:0;background:linear-gradient(20deg,#445c34,#182e24);color:#fff1c4;height:100vh;display:grid;place-items:center;font:16px sans-serif"><p>BRIDGE STUB · HOST UI TEST ONLY</p><script>
let instanceId,travel,focus,failed=false;const commands=[];
function send(type,payload={}){if(type==='error')failed=true;parent.postMessage({channel:'squabblemon-fadewood',version:1,instanceId,type,...payload},location.origin)}
window.__fadewoodChild={commands,send,autoFocus:false,complete:()=>travel&&send('travelComplete',travel),completeFocus:()=>focus&&send('focusComplete',focus)};
addEventListener('message',event=>{const c=event.data;if(event.source!==parent||event.origin!==location.origin||c.channel!=='squabblemon-fadewood')return;commands.push(c);if(c.type==='init'){instanceId=c.instanceId;if(failed)send('error',{message:'Synthetic renderer failure'});else{send('progress',{progress:100,label:'Stub ready'});send('ready')}}if(c.type==='travel')travel={requestId:c.requestId,destinationId:c.destinationId};if(c.type==='focus'){focus={requestId:c.requestId,sourceId:c.sourceId};if(window.__fadewoodChild.autoFocus)send('focusComplete',focus)}});
<\/script></body></html>`;

async function setup(viewport, query = '') {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', hasTouch: viewport.width < 900 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/scenes/fadewood/index.html?host=1', route => route.fulfill({ contentType: 'text/html', body: child }));
  await page.goto(`${origin}/e2e/fadewood-world.fixture.html${query}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.fadewood-world[data-world-state="ready"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  const frame = page.frames().find(candidate => candidate.url().includes('/scenes/fadewood/'));
  const send = (type, payload = {}) => frame.evaluate(({ type, payload }) => window.__fadewoodChild.send(type, payload), { type, payload });
  const last = async type => (await frame.evaluate(() => window.__fadewoodChild.commands)).findLast(command => command.type === type);
  const waitForCommand = (type, oldId) => frame.waitForFunction(({ type, oldId }) => {
    const latest = window.__fadewoodChild.commands.findLast(command => command.type === type);
    return latest && latest.requestId !== oldId;
  }, { type, oldId });
  const acknowledgeFocus = async oldId => { await waitForCommand('focus', oldId); await frame.evaluate(() => window.__fadewoodChild.completeFocus()); };
  const autoFocus = () => frame.evaluate(() => { window.__fadewoodChild.autoFocus = true; });
  return { context, page, frame, send, last, waitForCommand, acknowledgeFocus, autoFocus, errors };
}
async function fits(locator) {
  return locator.evaluate(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, fits: r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 0 && r.bottom <= innerHeight + 1 }; });
}
try {
  for (const [name,width,height] of [['phone',390,844],['desktop',1440,960]]) {
    const {context,page,send,last,autoFocus,errors}=await setup({width,height},'?route=1&dynamic=kumite');
    await autoFocus();
    await send('inspect',{sourceId:'dr-fade'});
    const panel=page.locator('.fadewood-character-panel');
    await panel.waitFor();
    assert.equal(await panel.getByRole('button',{name:'Breakthrough · CPU practice',exact:true}).count(),1);
    await panel.getByRole('button',{name:/^Continue /}).click();
    await page.locator('.story-atlas__viewport').waitFor();
    assert.equal(await page.locator('.fadewood-world').count(),0,'Host opens map, not another character interaction');
    assert.equal(await page.getByTestId('story-movie').count(),0,'Map entry never auto-plays a cutscene');
    const node=page.locator('.story-atlas__node[aria-disabled="false"]').first();
    await node.click();
    await page.getByRole('button',{name:'← MAP',exact:true}).waitFor();
    await page.getByRole('button',{name:'← MAP',exact:true}).click();
    await page.getByTestId('story-movie').waitFor({state:'hidden'});
    await page.locator('.story-atlas__viewport').waitFor();
    assert.equal(await page.locator('.fadewood-world').count(),0,'Map returns to the actual chapter map');
    await page.screenshot({path:join(output,`${name}-chapter-map.png`)});
    assert.deepEqual(errors,[]);
    report.push({name,hostToMap:true,explicitNodeToMovie:true,movieBackToMap:true,errors});
    await context.close();
  }
  {
    const {context,page,send,autoFocus,errors}=await setup({width:390,height:844},'?route=1&dynamic=kumite');
    await autoFocus(); await send('inspect',{sourceId:'dr-fade'});
    await page.getByRole('button',{name:'Breakthrough · CPU practice',exact:true}).click();
    await page.getByTestId('breakthrough-lobby').waitFor();
    await page.getByRole('button',{name:/TRY A REVIEWED LOANER/}).click();
    assert.equal(await page.getByRole('button',{name:/PLAY CPU PRACTICE/}).isEnabled(),true);
    await page.getByRole('button',{name:/PLAY CPU PRACTICE/}).click();
    await page.getByRole('button',{name:'Open rules and practice settings'}).waitFor();
    assert.deepEqual(errors,[]);
    report.push({practiceFromDrFade:true,loanerStartsCpuMatch:true,errors});
    await context.close();
  }
  await writeFile(join(output,'route-summary.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await browser.close(); }
