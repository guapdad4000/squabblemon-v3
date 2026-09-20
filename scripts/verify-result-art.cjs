const { chromium }=require('playwright');
const fs=require('fs');
(async()=>{
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const [label,width,height,state] of [['desktop',1440,1000,'win'],['phone',390,844,'win'],['loss-phone',390,844,'loss'],['tablet',900,800,'win'],['loss-wide',1440,1000,'loss'],['draw',390,844,'draw'],['error',390,844,'error'],['guest',390,844,'guest'],['pending',390,844,'pending'],['story',1440,1000,'story']]){
await page.setViewportSize({width,height});await page.goto(`http://127.0.0.1:4179/squabblemon/e2e/result-stage.fixture.html?state=${state}`);await page.locator('.result-art__image').waitFor();await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
const result=await page.evaluate(()=>({overflow:document.querySelector('.result-stage').scrollWidth>innerWidth, image:document.querySelector('.result-art__image').currentSrc,broken:[...document.images].filter(i=>!i.naturalWidth).length}));
if(result.overflow||result.broken)throw Error(JSON.stringify(result));
await page.screenshot({path:`artifacts/squabblemon/screenshots/result-art-${label}.png`});
if(state==='error'){await page.getByRole('button',{name:'Retry Save'}).click();await page.getByText('Battle earnings',{exact:true}).waitFor();}
if(state==='win'){await page.getByRole('button',{name:'View scene'}).click();await page.getByRole('button',{name:'Show results'}).click();await page.getByTestId('button-restart-match').click();if(await page.title()!=='Restart requested')throw Error('Replay callback failed');}
console.log(label,JSON.stringify(result));
}
await browser.close();if(errors.length)throw Error(errors.join('\n'));
})();
