import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const require=createRequire(root+'/package.json'), sharp=require('sharp');
const reportIndex=process.argv.indexOf('--report');
const reportPath=reportIndex>=0?path.resolve(process.argv[reportIndex+1]):null;
const dest=root+'/src/assets/collector-v2'; await fs.mkdir(dest,{recursive:true});
const sourceIndex=process.argv.indexOf('--sources');
const src=sourceIndex>=0?path.resolve(process.argv[sourceIndex+1]):root+'/e2e/card-name-tags/system/assets';
if(process.argv.includes('--check')){
 const {createHash}=await import('node:crypto');
 const manifest=JSON.parse(await fs.readFile(root+'/src/assets/collector-v2/manifest.json','utf8'));
 for(const entry of manifest){const bytes=await fs.readFile(dest+'/'+entry.file);if(createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw new Error('Collector asset mismatch: '+entry.file);}
 console.log(manifest.length+' optimized collector assets verified.');process.exit(0);
}
const elements=['normal','fire','water','plant','air','electric','poison','light','dark','earth'];
const plates=[[10,10,296,460],[319,10,291,460],[625,10,292,460],[932,10,291,460],[1235,10,293,460],[10,492,296,473],[319,492,291,473],[625,492,292,473],[932,492,291,473],[1235,492,293,473]];
const fists=[[15,55,378,330],[399,42,405,345],[802,60,393,325],[1198,50,391,330],[1588,45,395,340],[15,398,383,352],[400,400,397,350],[801,389,394,362],[1196,382,392,365],[1588,404,395,344]];
const report=[];
async function save(pipeline,name,opts={}){
 const master=await pipeline.png().toBuffer();
 const first=await sharp(master).webp({quality:92,effort:4,alphaQuality:100}).toBuffer();
 const final=await sharp(master).webp({quality:84,effort:6,alphaQuality:100,...opts}).toBuffer();
 const chosen=final.length<first.length?final:first;
 await fs.writeFile(dest+'/'+name+'.webp',chosen);
 report.push({name,decodedPng:master.length,firstPass:first.length,final:chosen.length});
}
for(let i=0;i<elements.length;i++){
 const [left,top,width,height]=plates[i];
 await save(i===1?sharp(src+'/fire-plate.png').resize({width:560,withoutEnlargement:true}):sharp(src+'/ten-element-backgrounds-study.png').extract({left,top,width,height}),elements[i]+'-plate');
 const [l,t,w,h]=fists[i];
 await save(sharp(src+'/element-fists-goldmaster-study.png').extract({left:l,top:t,width:w,height:h}).resize({width:240,height:220,fit:'inside',withoutEnlargement:true}),elements[i]+'-fist');
}
await save(sharp(src+'/rules-paper.png').resize({width:720,withoutEnlargement:true}),'rules-paper');
await save(sharp(root+'/e2e/card-name-tags/system/v2-materials/assets/prism-flakes.svg').resize(512,512),'prism-flakes',{lossless:true});
const {createHash}=await import('node:crypto');
const manifest=[];
for(const item of report){const file=item.name+'.webp';const bytes=await fs.readFile(dest+'/'+file);manifest.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await fs.writeFile(dest+'/manifest.json',JSON.stringify(manifest.sort((a,b)=>a.file.localeCompare(b.file)),null,2)+'\n');
if(reportPath)await fs.writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({files:report.length,firstPass:report.reduce((n,r)=>n+r.firstPass,0),final:report.reduce((n,r)=>n+r.final,0),details:report},null,2));
