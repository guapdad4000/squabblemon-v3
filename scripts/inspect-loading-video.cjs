const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:820}});
  await page.goto('http://localhost:4179/squabblemon/brand/loading-scenes.webm',{waitUntil:'domcontentloaded'});
  const metadata=await page.evaluate(async()=>{
   const video=document.querySelector('video'); video.muted=true;video.pause();
   if(video.readyState<1)await new Promise(resolve=>video.addEventListener('loadedmetadata',resolve,{once:true}));
   const info={duration:video.duration,width:video.videoWidth,height:video.videoHeight};
   const grid=document.createElement('div');grid.style='display:grid;grid-template-columns:repeat(3,1fr);gap:12px;background:#171717;color:white;padding:12px;font:16px sans-serif';
   for(const fraction of [.02,.18,.35,.52,.70,.90]){
    await new Promise(resolve=>{video.addEventListener('seeked',resolve,{once:true});video.currentTime=video.duration*fraction});
    const cell=document.createElement('div'),canvas=document.createElement('canvas');canvas.width=380;canvas.height=214;canvas.getContext('2d').drawImage(video,0,0,380,214);cell.append(canvas,document.createTextNode(`${video.currentTime.toFixed(1)}s`));grid.append(cell);
   }
   video.remove();document.body.replaceChildren(grid);return info;
  });
  console.log(JSON.stringify(metadata));await page.screenshot({path:'screenshots/loading-video-scenes.png'});
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
