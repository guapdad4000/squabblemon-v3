import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:720,height:600}});
const asset='http://127.0.0.1:4198/assets/bounty-hunter/v3/';
await fs.mkdir('/tmp/bounty-gif-frames',{recursive:true});
await page.goto('http://127.0.0.1:4198/e2e/bounty-gang.fixture.html?screen=bounties');
await page.setContent(`<style>html,body{margin:0;background:transparent}#stage{width:720px;height:600px;position:relative;overflow:hidden}img{position:absolute;bottom:0;right:0;width:570px;height:570px;object-fit:contain}#fired{opacity:0}.flash #idle{opacity:0}.flash #fired{opacity:1}#glint{position:absolute;width:3px;height:70%;background:linear-gradient(transparent,#ffe4a888,transparent);transform:rotate(18deg);left:0;top:70px}</style><div id=stage><img id=idle src="${asset}minigun-idle.webp"><img id=fired src="${asset}minigun-fired.webp"></div>`);
await page.locator('#idle').evaluate(i=>i.decode());await page.locator('#fired').evaluate(i=>i.decode());
for(let i=0;i<24;i++){await page.evaluate(i=>{const firing=i>=5&&i<17;document.querySelector('#stage').className=firing&&i%2?'flash':'';document.querySelector('#stage').style.transform=firing?`translate(${i%2*4}px,${i%3*2}px)`:'none';},i);await page.screenshot({path:`/tmp/bounty-gif-frames/gun-${String(i).padStart(2,'0')}.png`,omitBackground:true});}
await page.setContent(`<style>html,body{margin:0;background:#10201c}#stage{width:720px;height:600px;position:relative;overflow:hidden}img{position:absolute;height:570px;left:170px;top:15px}#glint{position:absolute;width:20px;height:470px;background:linear-gradient(transparent,#ffe4a855,transparent);transform:rotate(18deg);left:0;top:60px}</style><div id=stage><img src="${asset}award-case.webp"><div id=glint></div></div>`);await page.locator('img').evaluate(i=>i.decode());for(let i=0;i<24;i++){await page.locator('#glint').evaluate((n,i)=>n.style.left=150+i*18+'px',i);await page.screenshot({path:`/tmp/bounty-gif-frames/case-${String(i).padStart(2,'0')}.png`});}
await browser.close();
