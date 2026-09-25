import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { profileBootstrap } from './fighter-id.fixture.ts';

const origin=process.env.UI_ORIGIN ?? 'http://localhost:4199';
const output=process.env.REVIEW_OUTPUT ?? '/tmp/squabble-safehouse-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch();
const captures=[];
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.routeWebSocket('**',socket=>socket.close());
await page.addInitScript(()=>{localStorage.setItem('squabblemon_e2e_user','signed-in');localStorage.removeItem('squabblemon_safehouse_lighting');});
const bootstrap=profileBootstrap({id:'e2e-player',displayName:'HOME COURT',avatarKey:'kyle',settings:{reducedMotion:true,turnTimerEnabled:false}});
const message={id:'anniversary',title:'One year on the block.',sender:'The Squabblemon Team',sentAt:'2026-09-25T12:00:00Z',readAt:null,claimedAt:null,body:'You made this city what it is. Thanks for being here. Here’s a little something from all of us.\n\nSee you on the streets.',gift:{softCurrency:500,packTickets:2,styleShards:50}};
await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/bootstrap'))return route.fulfill({json:bootstrap});
  if(path.endsWith('/player/mail'))return route.fulfill({json:{messages:[message]}});
  if(path.includes('/player/mail/')){message.readAt=new Date().toISOString();return route.fulfill({json:{mail:message,credited:false}});}
  if(path.includes('/rewards/account'))return route.fulfill({json:{streak:1,pending:[],date:'2026-09-25'}});
  return route.fulfill({status:503,json:{error:'Isolated review preview'}});
});
async function capture(name,title){
  await page.screenshot({path:`${output}/${name}.png`});captures.push({name,title});console.log(`Captured ${name}`);
}
async function room(){await page.goto(`${origin}/squabblemon/game`);await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready','true',{timeout:60000});await expect(page.getByRole('button',{name:'Explore the mail door'})).toHaveAttribute('data-anchor-positioned','true');}
try{
  await room();
  await capture('01-room','Bright Safehouse, approved navigation icons, and red quick links');
  for(const [name,title,label]of[
    ['02-tv','TV, console, and speakers flush against the left wall','the television'],
    ['03-records','Fade Tunes beside the TV','the turntable'],
    ['04-growth','Growth Lab in the back-left corner','buddy’s plants'],
    ['05-profile','Metal bookshelf, plant, fist trophy, and profile portrait','your portrait shelf'],
    ['06-fadecade','Fadecade at the opposite end of the couch','the arcade machine'],
  ]){
    await page.getByRole('button',{name:`Explore ${label}`}).click();
    await page.waitForTimeout(700);
    await capture(name,title);
    await page.getByRole('button',{name:'Back to the room',exact:true}).click();
  }
  await page.getByRole('button',{name:'Explore the mail door'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(1100);
  const hide=await page.addStyleTag({content:'.mail-delivery[open]{visibility:hidden}.mail-delivery::backdrop{background:transparent;backdrop-filter:none}'});
  await capture('07-door-open','Oversized wooden mail door, opened with the camera turned toward it');
  await hide.evaluate(element=>element.remove());
  await page.getByRole('button',{name:/One year on the block/}).click();
  await expect(page.locator('.mail-letter-mascot')).toBeVisible();
  await page.locator('.mail-letter-mascot').evaluate(image=>image.decode());
  await capture('08-letter-desktop','Mailman delivery screen and chibi winged-shoe letter decoration');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(500);
  await capture('09-letter-phone','Letter decoration and gift claim on phone');
  await page.getByRole('button',{name:'Close mail',exact:true}).click();
  await capture('10-room-phone','Safehouse and navigation on phone');
  await page.setViewportSize({width:1440,height:900});
  await page.goto(`${origin}/squabblemon/e2e/rookie-journey.fixture.html`);
  await page.getByRole('button',{name:'Show me around'}).click();
  await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-scene-ready','true',{timeout:60000});
  const lessons=JSON.parse(await readFile('src/lib/safehouseTour.json','utf8'));
  for(const [index,lesson]of lessons.entries()){
    const panel=page.getByTestId('fade-spotlight');
    await expect(panel.getByRole('heading',{name:lesson.title,exact:true})).toBeVisible();
    if(['home-story-left','home-growth','home-profile','home-mail'].includes(lesson.id))await capture(`11-tour-${lesson.id}`,`Revised walkthrough: ${lesson.title}`);
    if(lesson.next)await panel.getByRole('button',{name:lesson.next,exact:true}).click();
    else if(index===lessons.length-1)await page.getByRole('button',{name:'Build your gang',exact:true}).click();
    else await page.locator(lesson.target).click();
  }
  await expect(page.getByTestId('dr-fade-welcome')).toBeVisible();
  await capture('12-tour-handoff','The revised tour still hands off to Dr. Fade and your first gang');
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile(`${output}/manifest.json`,JSON.stringify(captures,null,2));
  console.log(`Verified all ${lessons.length} tour steps and captured ${captures.length} screens.`);
}finally{await browser.close();}
