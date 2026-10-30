#!/usr/bin/env python3
from pathlib import Path
from PIL import Image,ImageSequence
import json,hashlib,subprocess,argparse
parser=argparse.ArgumentParser(description="Verify a pending-media compression review against retained originals")
parser.add_argument("--review-dir",type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1];out=args.review_dir.resolve();records=json.loads((out/'report.json').read_text()); public=root/'artifacts/squabblemon/public'
for r in records:
 a=out/'before'/r['asset'];b=public/r['asset'];assert hashlib.sha256(b.read_bytes()).hexdigest()==r['afterSha256']
 if a.suffix=='.mp4':
  def probe(p):return json.loads(subprocess.check_output(['/usr/bin/ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))
  x,y=probe(a),probe(b)
  assert abs(float(x['format']['duration'])-float(y['format']['duration']))<.05
  for u,v in zip(x['streams'],y['streams']):
   for k in ['codec_name','width','height','r_frame_rate','nb_frames','sample_rate','channels']:assert u.get(k)==v.get(k),(a,k)
  def audio(p):return subprocess.check_output(['/usr/bin/ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-c','copy','-f','hash','-hash','sha256','-'])
  assert audio(a)==audio(b)
 else:
  x,y=Image.open(a),Image.open(b); assert x.size==y.size and getattr(x,'n_frames',1)==getattr(y,'n_frames',1)
  for u,v in zip(ImageSequence.Iterator(x),ImageSequence.Iterator(y)):
   assert u.info.get('duration')==v.info.get('duration'),str(a)
   assert u.convert('RGBA').getchannel('A').tobytes()==v.convert('RGBA').getchannel('A').tobytes(),str(a)
print(f'{len(records)} files: matching checksums, dimensions, frame counts, timing, exact alpha, copied audio. PASS')
