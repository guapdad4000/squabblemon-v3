import { expect, test } from '@playwright/test';
const fixture='/squabblemon/e2e/squabble-house.fixture.html';
const shots='../../artifacts/deliverables/squabble-house-story-arc/movie-audit';

test('new poster opens an available six-chapter arc and illustrated map',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${fixture}?view=theater`);
 const poster=page.getByTestId('button-presentation-special-squabble-house');await poster.focus();
 await expect(poster).toHaveAttribute('data-status','available');await expect(poster).toBeInViewport();
 expect(await poster.locator('img').evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBeGreaterThan(500);
 await page.screenshot({path:`${shots}/poster.png`});
 await page.goto(`${fixture}?view=map`);
 await expect(page.locator('.house-atlas')).toBeVisible();await expect(page.locator('.story-atlas__node')).toHaveCount(4);
 const box=await page.locator('.story-atlas__viewport').boundingBox();expect(box!.height).toBeGreaterThan(200);
 await page.screenshot({path:`${shots}/map.png`});
 await page.getByRole('button',{name:'Now Showing, available',exact:true}).click();
 await expect(page.getByTestId('story-movie')).toBeVisible();
});

for(let chapter=1;chapter<=6;chapter++)test(`chapter ${chapter}: actual media plays with audio and ends in 2D dialogue`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${fixture}?chapter=${chapter}`);
 await expect(page.getByTestId('story-movie')).toBeVisible();
 const video=page.locator('video');await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.readyState)).toBeGreaterThanOrEqual(2);
 expect(await video.evaluate((v:HTMLVideoElement)=>({width:v.videoWidth,duration:v.duration,muted:v.muted}))).toEqual({width:1920,duration:10,muted:false});
 await page.getByRole('button',{name:'▶ Play chapter',exact:true}).click();
 await expect.poll(()=>video.evaluate((v:HTMLVideoElement)=>v.currentTime)).toBeGreaterThan(0.7);
 await page.screenshot({path:`${shots}/ch0${chapter}-playing.png`});
 await expect(page.locator('.story-stage')).toBeVisible({timeout:15000});
 await expect(page.getByTestId('story-movie')).toHaveCount(0);
 expect(await page.locator('.story-stage__actor--speaker img').evaluate((i:HTMLImageElement)=>i.naturalWidth)).toBeGreaterThan(0);
 await page.screenshot({path:`${shots}/ch0${chapter}-dialogue.png`});
 expect(errors).toEqual([]);
});

test('missing movie fails gracefully and phone player stays within screen',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/media/ch01.mp4',r=>r.abort());
 await page.goto(fixture);await expect(page.getByRole('status')).toContainText('couldn’t load');
 await page.getByRole('button',{name:'Continue to dialogue →'}).click();await expect(page.locator('.story-stage')).toBeVisible();
 await page.screenshot({path:`${shots}/phone-dialogue.png`});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('closing dialogue claims the House card',async({page})=>{
 await page.goto(`${fixture}?view=reward&chapter=1`);
 await expect(page.locator('.story-stage')).toBeVisible();
 const skip=page.getByRole('button',{name:/Skip scene/i});
 await skip.click();
 await expect(page.getByRole('button',{name:'Return to Map'})).toBeVisible();
 await expect(page.locator('.story-node-overlay')).toContainText('Squabble House');
 await page.screenshot({path:`${shots}/card-reward.png`});
});

test('opening movie can be skipped and replayed after dialogue without re-claiming progress',async({page})=>{
 await page.goto(fixture);
 await page.getByRole('button',{name:'Continue to dialogue →'}).click();
 await page.getByRole('button',{name:/Skip scene/i}).click();
 await expect(page.getByTestId('story-movie')).toHaveCount(0);
 await page.getByRole('button',{name:'Replay movie',exact:true}).click();
 await expect(page.getByTestId('story-movie')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.house-atlas')).toBeVisible();
 await expect(page.getByTestId('story-movie')).toHaveCount(0);
});
