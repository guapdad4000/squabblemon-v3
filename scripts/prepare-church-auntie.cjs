// Church Auntie: remove explicitly audited white regions, preserving the illustration.
// node scripts/prepare-church-auntie.cjs [--apply]
const fs = require('node:fs');
const sharp = require('sharp');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const source = 'artifacts/squabblemon/art-sources/characters/church-auntie-sep19.png';
const cutout = 'artifacts/squabblemon/art-sources/characters/church-auntie-transparent.png';
const target = 'artifacts/squabblemon/public/assets/characters/church-auntie.webp';
// Outer canvas, arm/bag gap, handbag handle openings and buckles, and the hat ribbon loop.
const seeds = [[0,0],[811,677],[896,811],[398,29],[849,813],[831,845],[858,845],[922,838],[910,838],[863,768]];
(async () => {
  const {data, info:{width:w,height:h}} = await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const output = Buffer.from(data), mask = new Uint8Array(w*h), queue = new Int32Array(w*h);
  const neighbors = p => {const x=p%w,y=Math.floor(p/w);return [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1];};
  const background = p => {const k=p*4,lo=Math.min(data[k],data[k+1],data[k+2]),hi=Math.max(data[k],data[k+1],data[k+2]);return lo>=235 && hi-lo<=18;};
  for (const [x,y] of seeds) {
    const seed=y*w+x;assert(background(seed), `Invalid background seed ${x},${y}`);
    if(mask[seed])continue;
    let head=0,tail=1;queue[0]=seed;mask[seed]=1;
    while(head<tail)for(const p of neighbors(queue[head++]))if(p>=0&&!mask[p]&&background(p)){mask[p]=1;queue[tail++]=p;}
  }
  let cleared=0,feathered=0;
  for(let p=0;p<w*h;p++) {
    const k=p*4;
    if(mask[p]){output[k+3]=0;cleared++;continue;}
    if(!neighbors(p).some(n=>n>=0&&mask[n]))continue;
    const lo=Math.min(data[k],data[k+1],data[k+2]),hi=Math.max(data[k],data[k+1],data[k+2]);
    if(lo<100||hi-lo>55)continue;
    const alpha=Math.min(1,(255-lo)/155);
    output[k+3]=Math.round(255*alpha);
    // Unmix the former white matte from the one-pixel antialiased boundary.
    for(let c=0;c<3;c++)output[k+c]=Math.max(0,Math.min(255,Math.round((data[k+c]-255*(1-alpha))/alpha)));
    feathered++;
  }
  assert(cleared>850000 && cleared<910000,'Unexpected mask area');
  for(const [x,y] of [[550,420],[180,280],[655,120],[450,800],[905,1410],[210,1420]])assert.equal(output[(y*w+x)*4+3],255,'Character interior must remain opaque');
  await sharp(output,{raw:{width:w,height:h,channels:4}}).png().toFile(cutout);
  fs.mkdirSync('screenshots/church-alpha',{recursive:true});
  for(const color of ['#152832','#ae327d'])await sharp(cutout).flatten({background:color}).resize({width:600}).png().toFile(`screenshots/church-alpha/cutout-${color.slice(1)}.png`);
  if(process.argv.includes('--apply')){
    await sharp(cutout).resize({width:768}).webp({quality:94,alphaQuality:100,effort:6}).toFile(target);
    const revisionsPath='artifacts/squabblemon/src/characterRevisions.json';
    const revisions=JSON.parse(fs.readFileSync(revisionsPath,'utf8'));
    revisions['church-auntie']=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex').slice(0,16);
    fs.writeFileSync(revisionsPath,JSON.stringify(revisions,null,2)+'\n');
  }
  console.log(JSON.stringify({cutout,cleared,feathered,applied:process.argv.includes('--apply')}));
})().catch(error=>{console.error(error);process.exitCode=1});

