import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const [root,out,mode]=process.argv.slice(2);
const sharp=createRequire(path.join(root,'artifacts/squabblemon/package.json'))('sharp');
const audit=JSON.parse(await fs.readFile(path.join(out,'audit.json'),'utf8'));
const files=(await fs.readdir(path.join(out,'generated'))).filter(f=>f.endsWith('.json'));
const records=await Promise.all(files.map(f=>fs.readFile(path.join(out,'generated',f),'utf8').then(JSON.parse)));
if(mode!=='--partial'&&records.length!==audit.missing.length*2)throw Error(`Incomplete generation: ${records.length}/${audit.missing.length*2}`);
const expected=new Set(audit.missing.flatMap(c=>['banner','deckCover'].map(kind=>c.id+':'+kind)));
const seen=new Set();
for(const r of records){const key=r.id+':'+r.kind;if(!expected.has(key)||seen.has(key))throw Error('Unexpected or duplicate asset '+key);seen.add(key);}
const report=[];
for(const record of records){
 const wide=record.kind==='banner',asset=`assets/cosmetics/${record.id}/${wide?'banner':'deck-cover'}-v4.webp`;
 const image=sharp(record.path),meta=await image.metadata();
 const expected=wide?3:2/3;if(!meta.width||!meta.height||Math.abs(meta.width/meta.height-expected)>0.08)throw Error(`Unexpected aspect ratio ${record.id} ${record.kind} ${meta.width}x${meta.height}`);
 const output=path.join(out,asset);await fs.mkdir(path.dirname(output),{recursive:true});
 await image.resize(wide?1600:768,wide?533:1152,{fit:'contain',background:'#090807'}).webp({quality:88,effort:6}).toFile(output);
 const master=path.join(out,'masters',`${record.id}-${record.kind}.png`);await fs.mkdir(path.dirname(master),{recursive:true});await fs.copyFile(record.path,master);
 if(mode!=='--partial'){const runtime=path.join(root,'artifacts/squabblemon/public',asset);await fs.mkdir(path.dirname(runtime),{recursive:true});await fs.copyFile(output,runtime);}
 const buf=await fs.readFile(output);report.push({...record,path:undefined,master:path.relative(out,master),asset,bytes:buf.length,sha256:createHash('sha256').update(buf).digest('hex'),sourceWidth:meta.width,sourceHeight:meta.height});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({generator:'built-in image_gen',existingCharactersPreserved:59,newCharacters:69,expectedAssets:138,complete:report.length===138,assets:report},null,2)+'\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=audit.missing.map(c=>{const a=report.filter(r=>r.id===c.id);if(!a.length)return '';return `<article data-search="${esc(c.name.toLowerCase())}"><h2>${esc(c.name)}</h2><p>${esc(c.rarity==='Epic'?'Super Rare':c.rarity)}</p><div class="pair">${a.map(r=>`<a class="${r.kind}" href="${r.asset}"><img src="${r.asset}" alt="${esc(c.name)} ${r.kind==='banner'?'banner':'deck cover'}" loading="lazy"><span>${r.kind==='banner'?'Banner':'Deck cover'}</span></a>`).join('')}</div></article>`}).join('');
await fs.writeFile(path.join(out,'REVIEW.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon Character Signatures</title><style>*{box-sizing:border-box}body{margin:0;background:#100e0c;color:#f9edce;font-family:system-ui,sans-serif;padding:clamp(16px,4vw,56px)}header{max-width:1500px;margin:0 auto 32px}h1{font-size:clamp(30px,5vw,64px);text-transform:uppercase;margin:0 0 12px}header p{color:#d9bb79}input{width:min(100%,520px);padding:16px;background:#211d18;color:white;border:1px solid #806634;border-radius:6px;font:inherit}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:24px;max-width:1500px;margin:auto}article{padding:18px;background:#1a1612;border:1px solid #524125;border-radius:8px;min-width:0}h2{margin:0;font-size:22px}article p{font-size:12px;text-transform:uppercase;color:#c7a76b;margin:7px 0 16px}.pair{display:grid;grid-template-columns:1fr 35%;gap:14px;align-items:start}a{color:#eacc8d;text-decoration:none;min-width:0}img{display:block;width:100%;height:auto;background:#090807;border:1px solid #675330}.banner{grid-column:1/-1}.deckCover{grid-column:1;width:50%}span{display:block;font-size:12px;margin-top:7px}[hidden]{display:none}</style><header><h1>Character signatures</h1><p>${report.length} / 138 generated assets · 69 characters · Existing art preserved</p><input id="search" type="search" placeholder="Find a character" aria-label="Find a character"></header><main>${cards}</main><script>document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('article').forEach(a=>a.hidden=!a.dataset.search.includes(q))})</script></html>`);
console.log(JSON.stringify({assets:report.length,complete:report.length===138,bytes:report.reduce((n,r)=>n+r.bytes,0)}));
