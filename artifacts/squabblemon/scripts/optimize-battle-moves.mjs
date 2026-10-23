import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const sourceRoot=path.join(root,'public/assets/special-moves');
const outputRoot=path.join(root,'public/assets/battle-moves');
const manifestPath=path.join(root,'src/lib/battleMoves.json');
const catalog=JSON.parse(await fs.readFile(path.join(root,'src/specialMoves.json'),'utf8'));
const revision=file=>Object.values(catalog.clips).find(clip=>clip.file===file)?.revision??null;
let manifest={};try{manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch{}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv.includes('--check')){
 for(const [source,entry] of Object.entries(manifest)){
  if(hash(await fs.readFile(path.join(sourceRoot,source)))!==entry.sourceHash||revision(source)!==entry.revision)throw new Error('Regenerate battle move: '+source);
  await fs.access(path.join(root,'public',entry.asset));
 }
 console.log(Object.keys(manifest).length+' current battle move derivatives verified.');process.exit(0);
}
const files=process.argv.slice(2).filter(file=>file.endsWith('.mp4'));
if(!files.length)throw new Error('Specify authored MP4 filenames to optimize. Originals are retained.');
await fs.mkdir(outputRoot,{recursive:true});
for(const file of files){
 if(path.basename(file)!==file)throw new Error('Filename must be inside special-moves');
 const input=path.join(sourceRoot,file),bytes=await fs.readFile(input),sourceHash=hash(bytes);
 const asset='assets/battle-moves/'+path.basename(file,'.mp4')+'-'+sourceHash.slice(0,12)+'.mp4';
 const output=path.join(root,'public',asset);
 execFileSync('ffmpeg',['-nostdin','-v','error','-y','-i',input,'-map','0:v:0','-map','0:a?','-vf','scale=min(432\\,iw):-2:flags=lanczos','-c:v','libx264','-preset','slow','-crf','23','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',output]);
 const after=(await fs.stat(output)).size;
 if(after<bytes.length*.85){manifest[file]={asset,revision:revision(file),sourceHash,before:bytes.length,after};console.log(JSON.stringify({file,before:bytes.length,after}));}
}
await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
