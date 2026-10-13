const previewOrigin=process.env.PLAYER_NOTES_ORIGIN??'http://127.0.0.1:4293';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require=createRequire(new URL('../package.json',import.meta.url));const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({headless:true});const output='/home/falcon/Documents/New project 9/artifacts/deliverables/player-notes-20261012';const report=[];
try{for(const width of [390,1440]){const context=await browser.newContext({viewport:{width,height:width===390?844:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{
 await page.goto(previewOrigin+'/e2e/player-notes.fixture.html?screen=community&motion=reduce&limited=true');
 await expect(page.locator('.crew-select__preview h3')).toHaveText('THE CIRCUIT');
 await page.getByRole('button',{name:'Next team',exact:true}).click();await expect(page.locator('.crew-select__preview h3')).toHaveText('TOUR MONEY');
 await page.locator('.crew-select__row').nth(1).focus();await page.keyboard.press('ArrowUp');await expect(page.locator('.crew-select__preview h3')).toHaveText('THE CIRCUIT');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/screenshots/deck-select-${width}.png`});
 await page.getByRole('button',{name:/CONTENDERS/}).click();await page.getByRole('button',{name:'GIVE RESPECT',exact:true}).click();await expect(page.getByRole('button',{name:'RESPECT GIVEN',exact:true})).toBeDisabled();
 await expect(page.locator('.crew-select__row[aria-pressed=true]')).toContainText('29');
 await page.getByRole('button',{name:'TRY THIS CREW ↗'}).click();await expect(page.getByText('ALL TEN CARDS. YOUR HANDS.')).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();await page.waitForTimeout(500);
 await page.getByRole('button',{name:'Previous player picks ✊'}).click();await expect(page.locator('.community-archive .community-crew')).toHaveCount(3);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);report.push({width,selection:true,keyboard:true,voting:true,trialBrief:true,archive:true,noOverflow:true});
 }finally{await context.close();}}}finally{await browser.close();}
writeFileSync(`${output}/deck-select-browser.json`,JSON.stringify(report,null,2));console.log('Arcade crew selection passed at both widths.');
