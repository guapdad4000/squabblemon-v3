import {chromium,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.env.MATCH_DESIGN_OUTPUT ?? '/tmp/kumite-match-design';mkdirSync(out,{recursive:true});
const b=await chromium.launch();const results=[];
async function capture(p,name,width){await p.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});await expect.poll(()=>p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await p.screenshot({path:`${out}/${name}-${width}.png`,animations:'disabled'});}
try{for(const [width,height] of [[320,568],[390,844],[844,390],[1440,960]]){
 const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5195/e2e/breakthrough-match-design.fixture.html');
 const opener=p.getByRole('button',{name:'Open rules and settings'});await opener.waitFor();
 await capture(p,'match',width);
 await p.locator('.bt-card').nth(1).click();await capture(p,'fighter',width);
 await p.getByRole('button',{name:/Deploy Nabu in lane 1/}).click();
 await expect.poll(()=>p.evaluate(()=>window.matchDesign.commands.length)).toBe(1);
 await capture(p,'deployed',width);
 const squabble=p.getByRole('button',{name:'Squabble',exact:true});await squabble.click();await expect(p.getByRole('button',{name:'Squabble armed'})).toHaveAttribute('aria-pressed','true');await p.getByRole('button',{name:'Squabble armed'}).click();
 await opener.click();await capture(p,'menu',width);
 await p.getByText('HOW TO PLAY',{exact:true}).click();await expect(p.getByText('BETA IN PREPARATION')).toHaveCount(0);
 await p.getByText('HOW TO PLAY',{exact:true}).click();
 await p.getByRole('button',{name:'SURRENDER MATCH',exact:true}).click();await expect(p.getByRole('button',{name:'KEEP PLAYING'})).toBeFocused();await capture(p,'surrender',width);
 await p.keyboard.press('Escape');await expect(opener).toBeFocused();await opener.click();await expect(p.getByRole('button',{name:'KEEP PLAYING'})).toHaveCount(0);
 await p.getByRole('button',{name:'SURRENDER MATCH',exact:true}).click();await p.getByRole('button',{name:'KEEP PLAYING'}).click();await expect(p.getByRole('button',{name:'RESUME →'})).toBeVisible();
 await p.getByRole('button',{name:'RESUME →'}).click();
 await p.evaluate(()=>window.matchDesign.setMessage('Reconnecting… Match continues.'));await expect(p.locator('.bt-online-status')).toHaveText('Reconnecting… Match continues.');await capture(p,'reconnect',width);await p.evaluate(()=>window.matchDesign.setMessage(''));
 await expect(p.locator('.bt-online-status')).toHaveCount(0);await opener.click();await p.getByRole('button',{name:'SURRENDER MATCH',exact:true}).click();await p.getByRole('button',{name:'SURRENDER MATCH',exact:true}).click();
 expect(await p.evaluate(()=>window.matchDesign.commands.filter(c=>c.kind==='surrender'))).toEqual([{kind:'surrender'}]);
 await p.goto('http://127.0.0.1:5195/e2e/breakthrough-match-design.fixture.html?choice');await p.locator('.bt-card').nth(1).click();await p.getByRole('button',{name:/Deploy Homeless Guy in lane 1/i}).click();
 await p.getByRole('dialog').waitFor();await capture(p,'choice',width);await p.getByRole('button',{name:'Cancel card choice'}).click();
 expect(await p.evaluate(()=>window.matchDesign.commands)).toEqual([]);expect(errors).toEqual([]);
 results.push({width,height,overflow:false,errors,confirmationReset:true,cancel:true,singleSurrender:true});await p.close();
}}finally{await b.close()}
writeFileSync(`${out}/report.json`,JSON.stringify(results,null,2));console.log(results);
