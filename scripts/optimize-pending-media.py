#!/usr/bin/env python3
"""Pending-patch media optimizer. Run once from retained originals, never chain lossy passes.
After applying, refresh provenance manifests and run media integrity/release checks.
Requires Pillow and system FFmpeg. Two encoder threads prevent resource spikes.
"""
from pathlib import Path
from PIL import Image, ImageSequence
import subprocess,json,hashlib,shutil,re,argparse
parser=argparse.ArgumentParser(description="Compress pending public media; retain originals in an external review directory.")
parser.add_argument("--review-dir",type=Path,required=True)
parser.add_argument("--apply",action="store_true",help="Replace runtime files after encoding; default only builds candidates")
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]; PUBLIC=ROOT/'artifacts/squabblemon/public'; OUT=args.review_dir.resolve(); OUT.mkdir(parents=True,exist_ok=True)
if OUT.is_relative_to(PUBLIC): raise SystemExit('Review originals must remain outside public deployment assets')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
files=set(subprocess.check_output(['git','ls-files','--others','--exclude-standard','artifacts/squabblemon/public'],cwd=ROOT,text=True).splitlines()+subprocess.check_output(['git','diff','--name-only','--','artifacts/squabblemon/public'],cwd=ROOT,text=True).splitlines())
records=[]
for name in sorted(files):
 p=ROOT/name
 if not p.is_file() or p.suffix not in ['.webp','.mp4','.gif','.png']:continue
 rel=p.relative_to(PUBLIC); backup=OUT/'before'/rel;backup.parent.mkdir(parents=True,exist_ok=True)
 if not backup.exists():shutil.copy2(p,backup)
 candidate=OUT/'after'/rel;candidate.parent.mkdir(parents=True,exist_ok=True)
 rec={'asset':str(rel),'beforeBytes':backup.stat().st_size,'beforeSha256':sha(backup)}
 if p.suffix=='.mp4':
  probe=json.loads(run(['/usr/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(backup)]).stdout)
  probe.get('format',{}).pop('filename',None)
  for crf in [25,23,21]:
   run(['/usr/bin/ffmpeg','-v','error','-threads','2','-i',str(backup),'-map','0:v:0','-map','0:a?','-c:v','libx264','-preset','slow','-crf',str(crf),'-threads','2','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart','-y',str(candidate)])
   result=run(['/usr/bin/ffmpeg','-hide_banner','-threads','2','-i',str(backup),'-threads','2','-i',str(candidate),'-lavfi','ssim','-f','null','-']).stderr
   score=float(re.search(r'All:([0-9.]+)',result).group(1))
   if score>=.98:break
  rec.update(encoding=f'H264 slow CRF {crf}; original dimensions, fps and copied audio',ssim=score,probe=probe)
  if score<.98:shutil.copy2(backup,candidate)
 else:
  im=Image.open(backup); frames=[];duration=[]
  for frame in ImageSequence.Iterator(im):
   frames.append(frame.convert('RGBA').copy());duration.append(frame.info.get('duration',100))
  rec.update(width=im.width,height=im.height,frames=len(frames),durationsMs=duration)
  if p.suffix=='.webp':
   frames[0].save(candidate,format='WEBP',save_all=len(frames)>1,append_images=frames[1:],duration=duration,loop=im.info.get('loop',0),quality=80,method=6,exact=True)
   rec['encoding']='WebP quality80 method6; same pixels dimensions, alpha, frames and durations'
  elif p.suffix=='.png':
   im.save(candidate,optimize=True);rec['encoding']='PNG lossless optimize'
  else:
   shutil.copy2(backup,candidate);rec['encoding']='GIF retained to preserve disposal/transparency fallback'
 if candidate.stat().st_size>=backup.stat().st_size:shutil.copy2(backup,candidate);rec['encoding']='Original retained: candidate no smaller'
 rec.update(afterBytes=candidate.stat().st_size,afterSha256=sha(candidate))
 if args.apply: shutil.copy2(candidate,p)
 records.append(rec)
 (OUT/'report.json').write_text(json.dumps(records,indent=2)+'\n')
 print(rel,rec['beforeBytes'],rec['afterBytes'],flush=True)
print('TOTAL',sum(x['beforeBytes'] for x in records),sum(x['afterBytes'] for x in records),flush=True)

if args.apply:
 from datetime import date
 manifest={"date":str(date.today()),"scope":"Pending public media at audit start; unchanged existing media and source masters retained","beforeBytes":sum(x["beforeBytes"] for x in records),"afterBytes":sum(x["afterBytes"] for x in records),"assets":records}
 (ROOT/"docs/events/anunaki-media-optimization.json").write_text(json.dumps(manifest,indent=2)+"\n")
