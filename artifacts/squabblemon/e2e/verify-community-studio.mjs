const previewOrigin=process.env.PLAYER_NOTES_ORIGIN??'http://127.0.0.1:4293';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require=createRequire(new URL('../package.json',import.meta.url));
const { chromium,expect }=require('@playwright/test');
const output='/home/falcon/Documents/New project 9/artifacts/deliverables/player-notes-20261012/screenshots';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const report=[];
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const calls=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/player/matches'))calls.push(r.url());});
 try{
 await page.goto(previewOrigin+'/e2e/player-notes.fixture.html?screen=community&motion=reduce&limited=true');
 await expect(page.getByRole('button',{name:'TRY THIS CREW ↗'}).first()).toBeVisible();
 await page.getByRole('button',{name:'Next team',exact:true}).click();
 await expect(page.locator('.crew-select__preview h3')).toHaveText('TOUR MONEY');
 await page.locator('.crew-select__row').nth(1).focus();
 await page.keyboard.press('ArrowUp');
 await expect(page.locator('.crew-select__preview h3')).toHaveText('THE CIRCUIT');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`${output}/community-posters-${width}.png`});
 await page.getByRole('button',{name:'TRY THIS CREW ↗'}).first().click();
 await expect(page.getByText('ALL TEN CARDS. YOUR HANDS.')).toBeVisible();
 await page.screenshot({path:`${output}/community-trial-${width}.png`});
 await page.getByRole('button',{name:'STEP INTO PRACTICE ✊'}).click();
 await expect(page.getByText('Opening the practice floor…')).toHaveCount(0,{timeout:30000});
 await expect(page.getByTestId('lane-container-0')).toBeVisible({timeout:30000});
 await page.waitForTimeout(3500);
 expect(errors).toEqual([]);expect(calls).toEqual([]);
 await page.screenshot({path:`${output}/community-loaner-${width}.png`});
 await page.getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:'BUILD MY VERSION +'}).first().click();
 await page.waitForTimeout(800);
 await expect(page.getByText('1 cards to collect')).toBeVisible();
 await page.screenshot({path:`${output}/community-build-debug-${width}.png`});
 await expect(page.getByRole('button',{name:'Save deck',exact:true}).last()).toBeVisible();
 await page.screenshot({path:`${output}/community-build-${width}.png`});
 await page.getByRole('button',{name:'Save deck',exact:true}).last().click();
 await expect(page.getByText('Your version is saved in Cards & Gangs.')).toBeVisible();
 expect(errors).toEqual([]);
 report.push({width,poster:true,loanerNoRewardRequest:true,ownedBuildSaved:true});
 }finally{await context.close();}
}}finally{await browser.close();}
writeFileSync('/home/falcon/Documents/New project 9/artifacts/deliverables/player-notes-20261012/community-studio-browser.json',JSON.stringify(report,null,2));console.log('Community posters, loaner practice and owned saves passed at both widths.');
