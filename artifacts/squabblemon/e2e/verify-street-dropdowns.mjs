import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { installFadecadeApi } from './fadecade.fixture.ts';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true});
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:960}],['phone',{width:390,height:844}]]){
 const page=await browser.newPage({viewport});
 await page.addInitScript(()=>localStorage.setItem('squabblemon_e2e_user','signed-in'));
 await page.routeWebSocket('**',()=>{});
 await installFadecadeApi(page);
 const errors=[];page.on('pageerror',e=>{errors.push(e.message); console.log(e.message);});
 await page.goto('http://127.0.0.1:4198/game/challenges');
 await page.getByRole('button',{name:'Open training circuit',exact:true}).click();
 const mode=page.getByRole('combobox',{name:'Select Training Mode'});
 await mode.click();
 await page.getByRole('listbox').waitFor();
 await page.screenshot({path:`screenshots/dropdown-sign-${name}.png`});
 const lastValue=await page.getByRole('option').last().getAttribute('data-value');
 await page.getByRole('option').first().focus();
 await page.keyboard.press('End');
 await page.waitForFunction(value=>document.activeElement?.getAttribute('data-value')===value,lastValue);
 await page.keyboard.press('Enter');
 assert.equal(await mode.getAttribute('data-value'),lastValue);
 assert.equal(await page.getByRole('listbox').count(),0);
 await mode.focus();await page.keyboard.press('Space');
 await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Select Training Mode');
 await page.keyboard.press('Escape');
 await page.locator('.city-header').getByRole('button',{name:'Music controls',exact:true}).click();
 const tracks=page.getByRole('combobox',{name:'Choose music track'});
 await tracks.click();
 const menu=page.getByRole('listbox');
 await menu.waitFor();
 assert.equal(await menu.evaluate(el=>!!el.closest('dialog[open]')),true,'Menu must remain in native dialog top layer');
 const bounds=await menu.boundingBox();
 assert(bounds.x>=0 && bounds.x+bounds.width<=viewport.width+1);
 await page.screenshot({path:`screenshots/dropdown-paper-${name}.png`});
 const option=page.getByRole('option').first();
 const title=await option.innerText();
 await option.click();
 assert.equal((await tracks.innerText()).trim().toUpperCase(),title.trim().toUpperCase());
 assert.equal(await page.locator('dialog.music-dialog[open]').count(),1,'Choosing a track must not close music controls');
 assert.deepEqual(errors,[]);
 console.log('PASS',name,'sign and paper menus, keyboard selection, Escape focus, dialog layering and viewport fit');
 await page.close();
 }
}finally{await browser.close();}
