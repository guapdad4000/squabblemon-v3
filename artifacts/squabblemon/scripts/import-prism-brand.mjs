/** Curated import. Source masters are never modified; exact-byte duplicates are recorded. */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
const source = process.argv[2] || '/home/falcon/Downloads';
const kit = path.join(source, 'Squabblemon Brand Kit');
const out = path.resolve('public/brand/prismatic');
const word='1a285f30-e34b-4635-8a7b-89288291aef5', lock='5cfd5f51-311d-43ea-ad66-529c92c9d5d3', mono='aff04a89-03d1-4a3e-ad2c-fba36148bf44', fist='09214fdb-ed60-4b4a-b787-afe77b570c5e';
const wideLock='494bd52e-3dc8-4c8c-92e0-1343be575a75';
const entries = [
 ['f5eb5014-4d47-4c7a-b37f-c77479943221.png','logos/squabblemon-wordmark-gold',1440],
 ['a115678e-7f13-4ef4-b4e7-d5c0adc132d2.png','logos/squabblemon-lockup-gold',1440],
 ['faf17712-758f-42df-9d5b-2d3557b864bb.png','marks/monogram-gold',768],
 ['53c9f340-8191-49cb-87a9-fceb8a4ffdd3.png','marks/impact-gold',768],
 ['image-gen-1(20260926-045855).png','logos/squabblemon-wordmark-rainbow',1440],
 ['image-gen-2(20260926-045856).png','marks/monogram-rainbow',768],
 ['image-gen-3(20260926-045856).png','marks/impact-rainbow',768],
 ['828540e1-7106-46c6-a211-b1a15562ea6b.png','materials/prism-rainbow',1024],
 ['c4444bca-f2a5-4fbd-be7f-e737d7ef7cc5.png','materials/prism-gold',1024],
 ['be5646f1-5674-4a3f-99a3-37a104cf6658.png','source/rail-gold-white-background',0],
 [word+'.png','source/wordmark-white-original',0], [word+' (1).png','source/wordmark-black-hires',0], [word+' (2).png','source/wordmark-white-hires',0],
 [lock+'.png','source/lockup-white-original',0], [lock+' (1).png','source/lockup-black-outline-hires',0], [lock+' (2).png','source/lockup-white-outline-hires',0], [lock+' (3).png','source/lockup-black-filled-hires',0], [lock+' (4).png','source/lockup-white-filled-hires',0],
 [mono+'.png','source/monogram-white-original',0], [mono+' (1).png','source/monogram-white-outline-hires',0], [mono+' (2).png','source/monogram-black-hires',0], [mono+' (3).png','source/monogram-white-filled-hires',0],
 [fist+'.png','marks/impact-white-distressed',768], [fist+' (1).png','marks/impact-black',768], [fist+' (2).png','source/impact-black-duplicate',0],
 ['download','source/lockup-black-padded',0],
 [word+'.svg','vectors/wordmark-two-tone',1], [word+' (1).svg','vectors/wordmark-black',1], [word+' (2).svg','source/wordmark-vector-duplicate',0],
 [lock+'.svg','vectors/lockup-near-black',1], [lock+' (1).svg','vectors/lockup-white',1], [lock+' (2).svg','vectors/lockup-black',1], [lock+' (3).svg','vectors/lockup-two-tone',1],
 [mono+'.svg','vectors/monogram-white',1], [mono+' (1).svg','vectors/monogram-black',1], [mono+' (2).svg','vectors/monogram-two-tone',1],
 [wideLock+' (1).svg','vectors/lockup-wide-black',1], [wideLock+'.svg','vectors/lockup-wide-white',1],
 ['bd8a8bfe-4169-494f-899c-ed07e37ed06e.png','logos/squabblemon-lockup-wide-outline-white',1440],
 ['a3304380-49dd-4e8c-aaa9-b3b75e8c0074 (2).png','logos/squabblemon-wordmark-solid-white',1440],
 ['image-gen-3(20260926-053602).png','logos/squabblemon-wordmark-solid-black',1440],
 ['ChatGPT Image Sep 25, 2026, 10_44_49 PM.png','sheets/squabblemon-black-brand-sheet',1440],
 ['e792598c-53ec-4378-bf49-ce2efde5b2f2.png','marks/impact-black-outline',768],
 ['8e9111dc-4420-4aef-817e-1ae2a7c46e5c.png','source/wordmark-solid-black-duplicate',0],
 ['sm.png','marks/monogram-black-solid',768],
 [wideLock+' (2).png','logos/squabblemon-lockup-wide-black',1440],
 [wideLock+' (1).png','logos/squabblemon-lockup-wide-white',1440],
 [wideLock+'.png','source/lockup-wide-white-original',0],
];
const known = new Map(); const manifest=[];
await mkdir(kit,{recursive:true}); await mkdir(out,{recursive:true});
for (const [original,name,maxWidth] of entries) {
 const ext=path.extname(original)||'.png', master=path.join(kit,'masters',name+ext);
 const input=await access(path.join(source,original)).then(()=>path.join(source,original)).catch(()=>master);
 let bytes;
 try { bytes=await readFile(input); } catch(error) {
  const duplicateName = {[fist+' (2).png']:fist+' (1).png',[word+' (2).svg']:word+'.svg','8e9111dc-4420-4aef-817e-1ae2a7c46e5c.png':'image-gen-3(20260926-053602).png'}[original];
  const canonical=manifest.find(e=>e.original===duplicateName);
  if(!canonical)throw error;
  manifest.push({original,sha256:canonical.sha256,duplicateOf:canonical.original});continue;
 }
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(known.has(sha256)){manifest.push({original,sha256,duplicateOf:known.get(sha256)});continue;}
 known.set(sha256,original);
 await mkdir(path.dirname(master),{recursive:true}); if(input!==master)await copyFile(input,master);
 let exported=null;
 if (maxWidth) {
  exported=name+(ext==='.svg'?'.svg':'.webp'); const target=path.join(out,exported); await mkdir(path.dirname(target),{recursive:true});
  if(ext==='.svg') await copyFile(master,target);
  else {
   // Crop only surrounding transparent canvas, retaining the visible alpha bounds plus a safety gutter (exports often contain 1/255 alpha dust).
   const im=sharp(bytes); const meta=await im.metadata();
   let pipeline=im;
   if(meta.hasAlpha) {
    const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    let l=info.width,t=info.height,r=0,b=0;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>4){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
    if(r>=l&&b>=t){l=Math.max(0,l-8);t=Math.max(0,t-8);r=Math.min(info.width-1,r+8);b=Math.min(info.height-1,b+8);pipeline=pipeline.extract({left:l,top:t,width:r-l+1,height:b-t+1});}
   }
   await pipeline.resize({width:maxWidth,withoutEnlargement:true}).webp({quality:92,alphaQuality:100,effort:6}).toFile(target);
  }
 }
 manifest.push({original,sha256,master:path.relative(kit,master),exported});
}
const generated=[
 ['exec-342d08c2-c80f-425c-a813-4dbd0d89fa60.png','frames/prism-gold-nine-slice'],
 ['exec-f8427025-7b23-4850-93d5-3a9aba7ed984.png','frames/prism-gold-rail'],
];
for(const [filename,name] of generated){
 const original=path.join('/home/falcon/.codex/generated_images/01a0d88b-40b0-7803-8cc7-afa43300a0aa',filename);
 const master=path.join(kit,'generated',name+'.png');await mkdir(path.dirname(master),{recursive:true});await access(original).then(()=>copyFile(original,master)).catch(async()=>{await access(master);});
 const target=path.join(out,name+'.webp');await mkdir(path.dirname(target),{recursive:true});
 await sharp(master).resize({width:1024,withoutEnlargement:true}).webp({quality:93,alphaQuality:100,effort:6}).toFile(target);
 manifest.push({generatedBy:'built-in imagegen',master:path.relative(kit,master),exported:name+'.webp'});
}
// Separate corners and rail tiles for compositions that do not use CSS border-image.
const frame=path.join(out,'frames/prism-gold-nine-slice.webp');const size=(await sharp(frame).metadata()).width;const cut=Math.round(size*.2);
for(const [name,left,top,width,height] of [['corner-tl',0,0,cut,cut],['corner-tr',size-cut,0,cut,cut],['corner-bl',0,size-cut,cut,cut],['corner-br',size-cut,size-cut,cut,cut],['edge-top',cut,0,size-cut*2,cut],['edge-bottom',cut,size-cut,size-cut*2,cut],['edge-left',0,cut,cut,size-cut*2],['edge-right',size-cut,cut,cut,size-cut*2]]){await sharp(frame).extract({left,top,width,height}).webp({lossless:true}).toFile(path.join(out,'frames',name+'.webp'));manifest.push({derivedFrom:'frames/prism-gold-nine-slice.webp',exported:'frames/'+name+'.webp'});}
await writeFile(path.join(out,'manifest.json'),JSON.stringify({primary:'logos/squabblemon-wordmark-gold.webp',entries:manifest},null,2)+'\n');
await copyFile(path.join(out,'manifest.json'),path.join(kit,'manifest.json'));
console.log(JSON.stringify({uploads:entries.length,unique:known.size,duplicates:manifest.filter(x=>x.duplicateOf),kit,out},null,2));
// A portable, offline catalog makes white/black variants and true alpha easy to review.
const exports=manifest.filter(e=>e.exported).map(e=>e.exported);
const gallery=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon / Prismatic Brand Kit</title><style>
*{box-sizing:border-box}body{margin:0;background:#0b0d13;color:#f7edd8;font:15px system-ui,sans-serif}main{max-width:1250px;margin:auto;padding:32px 24px}header{display:flex;align-items:center;gap:40px;padding:20px 0 35px}header img{width:55%;max-height:230px;object-fit:contain}h1{font-size:28px;line-height:1.1}p{color:#c7baa4;line-height:1.6}button{padding:12px 18px;background:#e6c364;border:0;color:#191206;font-weight:700;cursor:pointer}h2{margin-top:40px}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}article{border:1px solid #594b2c;min-width:0}article a{display:block;color:inherit;text-decoration:none}figure{margin:0;height:220px;padding:18px;display:grid;place-items:center;background-color:var(--swatch,var(--default-swatch,#252733));background-image:linear-gradient(45deg,#ffffff10 25%,transparent 25%,transparent 75%,#ffffff10 75%),linear-gradient(45deg,#ffffff10 25%,transparent 25%,transparent 75%,#ffffff10 75%);background-size:24px 24px;background-position:0 0,12px 12px}figure img{width:100%;height:100%;object-fit:contain;min-height:0}figcaption{padding:13px;font-size:12px;overflow-wrap:anywhere}.demos{display:flex;flex-wrap:wrap;gap:24px}.demo{position:relative;display:grid;place-items:center;text-align:center;background:#121526;min-height:150px;padding:45px;flex:1}.demo:after{content:'';position:absolute;inset:0;border:42px solid transparent;border-image:url('frames/prism-gold-nine-slice.webp') 20% / 1 round;pointer-events:none}.demo.tall{min-height:280px;flex:.6}.demo strong{font-size:21px;display:block}.demo small{display:block;line-height:1.6;color:#e4d1a3}.count{font:12px monospace;color:#e6c364;letter-spacing:.1em}@media(max-width:600px){header{display:block}header img{width:100%}h1{font-size:23px}.demos{display:block}.demo{margin-bottom:20px}main{padding:18px}.demo.tall{min-height:180px}}
</style><main><header><img src="logos/squabblemon-wordmark-gold.webp" alt="Squabblemon"><div><span class="count">PRISMATIC BRAND SYSTEM / 01</span><h1>Gold hardware.<br>Full-spectrum attitude.</h1><p>${known.size} unique uploaded masters. Transparent marks, scalable foil borders, and two material stocks.</p><button onclick="document.body.style.setProperty('--swatch',this.dataset.light==='1'?'#252733':'#eeeeed');this.dataset.light=this.dataset.light==='1'?'0':'1'">Switch light / dark preview</button></div></header><h2>One frame. Any shape.</h2><div class="demos"><div class="demo"><div><strong>REVERSE HOLO</strong><small>Repeating rails • crisp corners<br>Content stays free to grow</small></div></div><div class="demo tall"><div><strong>GOLD PRISM</strong><small>Card / reward / panel</small></div></div></div>${['logos','marks','materials','frames','vectors','sheets'].map(group=>`<h2>${group.toUpperCase()}</h2><section>${exports.filter(e=>e.startsWith(group+'/')).map(e=>`<article><a href="${e}"><figure${e.includes('black')?' style="--default-swatch:#eeeeed"':''}><img src="${e}" alt="${e.split('/').pop()}" loading="lazy"></figure><figcaption>${e.split('/').pop()}</figcaption></a></article>`).join('')}</section>`).join('')}<p>Textures are intentionally opaque. Black logo variants start on a light preview; the button lets you compare either background. All supplied source masters, including alternate treatments and high-resolution print renders, are preserved in the organized masters folder. Exact duplicate hashes and their retained counterparts are recorded in manifest.json.</p></main></html>`;
await writeFile(path.join(out,'catalog.html'),gallery);
