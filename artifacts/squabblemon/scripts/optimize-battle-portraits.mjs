import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root=path.resolve(import.meta.dirname,'..');
const publicRoot=path.join(root,'public');
const manifestPath=path.join(root,'src/lib/battlePortraits.json');
const directory=path.join(publicRoot,'assets/battle-portraits');
const revisions={...JSON.parse(await fs.readFile(path.join(root,'src/characterRevisions.json'),'utf8')),...JSON.parse(await fs.readFile(path.join(root,'src/lib/storyPortraitRevisions.json'),'utf8'))};
if(process.argv.includes('--check')){
 const entries=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 for(const [source,entry] of Object.entries(entries)){
  const bytes=await fs.readFile(path.join(publicRoot,source));
  if(createHash('sha256').update(bytes).digest('hex')!==entry.sourceHash)throw new Error('Battle portrait needs regeneration: '+source);
  const id=path.basename(source,'.webp');
  if(source.startsWith('assets/characters/')&&(entry.revision??null)!==(revisions[id]??null))throw new Error('Battle portrait revision needs regeneration: '+source);
  await fs.access(path.join(publicRoot,entry.asset));
 }
 console.log(Object.keys(entries).length+' current battle portrait derivatives verified.');
 process.exit(0);
}
await fs.mkdir(directory,{recursive:true});sharp.concurrency(2);
const folders=['assets/characters','assets/kumite/fighters'];
const sources=(await Promise.all(folders.map(async dir=>(await fs.readdir(path.join(publicRoot,dir))).filter(name=>name.endsWith('.webp')).map(name=>dir+'/'+name)))).flat().sort();
const entries={},sizes=[];let cursor=0;
async function worker(){
 while(cursor<sources.length){const source=sources[cursor++],input=await fs.readFile(path.join(publicRoot,source)),metadata=await sharp(input).metadata();
  if((metadata.pages??1)>1)continue;
  const sourceHash=createHash('sha256').update(input).digest('hex');
  const buffer=await sharp(input).resize({width:384,height:576,fit:'inside',withoutEnlargement:true}).webp({quality:84,alphaQuality:95,effort:6}).toBuffer();
  if(buffer.length>=input.length*.85)continue;
  const name=path.basename(source,'.webp').replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+sourceHash.slice(0,12)+'-384.webp';
  const asset='assets/battle-portraits/'+name;
  await fs.writeFile(path.join(publicRoot,asset),buffer);
  entries[source]={asset,revision:source.startsWith('assets/characters/')?revisions[path.basename(source,'.webp')]??null:null,sourceHash};
  sizes.push({source,asset,before:input.length,after:buffer.length,width:metadata.width,height:metadata.height});
 }
}
await Promise.all(Array.from({length:4},worker));
await fs.writeFile(manifestPath,JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b))))+'\n');
const summary={portraits:sizes.length,before:sizes.reduce((n,x)=>n+x.before,0),after:sizes.reduce((n,x)=>n+x.after,0),sizes};
const reportIndex=process.argv.indexOf('--report');
if(reportIndex>=0&&process.argv[reportIndex+1])await fs.writeFile(path.resolve(process.argv[reportIndex+1]),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({portraits:summary.portraits,before:summary.before,after:summary.after}));
