const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.cwd()+'/artifacts/squabblemon/node_modules/@playwright/test');
(async()=>{
 const folder=process.cwd()+'/artifacts/deliverables/return-hands-fix';fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({headless:true});const results=[];
 try{for(const [name,viewport] of [['desktop',{width:1440,height:960}],['phone',{width:390,height:844}]]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4199/e2e/return-hands.fixture.html');await page.getByTestId('battle-arena').waitFor();
  const target=page.locator('[data-card-zone="board"][data-card-id="bonnet-girl"]');const before=Number(await target.getAttribute('data-card-power'));
  const dorothy=page.locator('[data-card-zone="hand"][data-card-id="dorothy"]');await dorothy.scrollIntoViewIfNeeded();await dorothy.click();await page.getByTestId('lane-1').click();await page.getByTestId('button-lock').click();
  const returned=page.locator('[data-card-zone="hand"][data-card-id="bonnet-girl"]');await returned.waitFor();assert.equal(Number(await returned.getAttribute('data-card-power')),before);
  await returned.scrollIntoViewIfNeeded();await page.screenshot({path:folder+'/'+name+'-returned.png'});
  await returned.click();await page.getByTestId('lane-2').click();await page.getByTestId('button-lock').click();await returned.waitFor({state:'detached'});
  const replayed=page.locator('[data-card-zone="board"][data-card-id="bonnet-girl"]');await replayed.waitFor();assert.equal(Number(await replayed.getAttribute('data-card-power')),before+1);
  await page.waitForTimeout(500);await page.screenshot({path:folder+'/'+name+'-replayed.png'});assert.deepEqual(errors,[]);
  results.push({viewport:name,before,returned:before,replayed:before+1,pageErrors:errors});await page.close();
 }}finally{await browser.close();}
 fs.writeFileSync(folder+'/browser-proof.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
