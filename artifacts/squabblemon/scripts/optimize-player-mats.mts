/** Rebuild runtime media from preserved approved exports, never from prior derivatives.
 * Set MAT_SHARP_MODULE to Sharp 0.35.5 for the release AVIF encoder.
 * node --import tsx scripts/optimize-player-mats.mts /absolute/path/to/masters /absolute/path/to/report.json
 */
import {createRequire} from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MAT_SHARP_MODULE ?? 'sharp');
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PLAYER_MATS} from '../../../lib/squabblemon-engine/src/playerMats';
import {catalogCardById} from '../../../lib/squabblemon-engine/src/data';
const [masters,reportFile]=process.argv.slice(2);
if(!masters||!reportFile)throw Error('Pass the preserved master directory and report filename.');
const root=path.resolve('public'),out=path.join(root,'assets/player-mats/v4');
await mkdir(out,{recursive:true});sharp.concurrency(1);sharp.cache({memory:64});
const venues=[['corner-store','corner-store','corner-store-court'],['harbor-skyline','moon-rooftop','harbor-skyline-court'],['civic-hill','civic-summit','civic-hill-climb'],['red-fence-night','red-court','red-fence-night-court'],['crown-rooftop','crown-court','crown-rooftop-court']];
type Job={name:string;source:string;thumbnail?:boolean;corner?:boolean};
const jobs:Job[]=[];
for(const mat of PLAYER_MATS.filter(m=>m.characterId)){
 const id=mat.characterId!;
 for(const kind of ['scene','illustration']) jobs.push({name:`${id}-${kind}`,source:path.join(masters,`${id}-${kind}.webp`)});
 jobs.push({name:`${id}-illustration-thumb`,source:path.join(masters,`${id}-illustration.webp`),thumbnail:true});
 const source=id==='og-uncle'?path.join(masters,'og-uncle-corner.webp'):id==='guap'?path.join(root,'assets/cosmetics/guap/sticker-action-v3.webp'):path.join(root,`assets/characters/${catalogCardById[id].artworkId}.webp`);
 jobs.push({name:`${id}-corner`,source,corner:true});
}
for(const [id,landscape,portrait]of venues){
 jobs.push({name:`${id}-scene`,source:path.join(root,`assets/layered/${landscape}.webp`)});
 jobs.push({name:`${id}-portrait`,source:path.join(root,`assets/venues/${portrait}.webp`)});
 jobs.push({name:`${id}-scene-thumb`,source:path.join(root,`assets/layered/${landscape}.webp`),thumbnail:true});
}
const results:unknown[]=[];
async function run(job:Job){
 const input=await readFile(job.source),meta=await sharp(input).metadata();
 const width=job.corner?Math.min(256,meta.width!):job.thumbnail?Math.min(640,meta.width!):meta.width!;
 const resized=await sharp(input).resize({width,withoutEnlargement:true}).png().toBuffer();
 const reference=await sharp(resized).ensureAlpha().raw().toBuffer();
 for(const format of job.corner?['webp'] as const:['webp','avif'] as const){
  const opts=format==='avif'?{quality:55,effort:7,chromaSubsampling:'4:4:4' as const}:{quality:job.corner?82:job.thumbnail?76:78,alphaQuality:100,effort:6,smartSubsample:true};
  const file=path.join(out,`${job.name}.${format}`);
  const output=process.argv.includes('--refresh-avif') && format==='webp' && !job.thumbnail ? await readFile(file) : await sharp(resized)[format](opts).toBuffer();
  const decoded=await sharp(output).ensureAlpha().raw().toBuffer();
  let squared=0,absolute=0,count=0;for(let i=0;i<reference.length;i+=4){if(job.corner&&reference[i+3]!==decoded[i+3])throw Error(job.name+' alpha changed');if(job.corner&&!reference[i+3])continue;for(let c=0;c<3;c++){const d=reference[i+c]-decoded[i+c];squared+=d*d;absolute+=Math.abs(d);count++;}}
  await writeFile(file,output);
  const result={encoder:process.argv.includes('--refresh-avif') && format==='webp' && !job.thumbnail ? 'preserved WebP 0.34.5' : sharp.versions.sharp,file:path.relative(root,file),source:job.source,role:job.corner?'corner':job.thumbnail?'thumbnail':'full',width,height:(await sharp(output).metadata()).height,format,inputBytes:input.length,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),meanAbsoluteError:absolute/count,psnr:squared?10*Math.log10(255*255/(squared/count)):null,...(job.corner?{alphaPreserved:true,errorMetric:"RGB of nontransparent pixels only"}:{})};
  results.push(result);
 }
 console.log(job.name);
}
// Two bounded encoders avoid exhausting device memory during browser work.
let index=0;await Promise.all([0,1].map(async()=>{while(index<jobs.length)await run(jobs[index++]);}));
await mkdir(path.dirname(reportFile),{recursive:true});await writeFile(reportFile,JSON.stringify({sharp:sharp.versions,settings:{fullWebp:78,thumbnailWebp:76,fullAvif:55,avifEffort:7,thumbnailWidth:640,cornerWidth:256,cornerWebp:82},assets:results},null,2));
console.log(`Wrote ${results.length} runtime files and ${reportFile}`);
