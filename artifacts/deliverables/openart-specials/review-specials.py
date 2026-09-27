#!/usr/bin/env python3
"""Stage original renders and audit media; never assigns or approves a game clip."""
import concurrent.futures
import hashlib
import json
import re
import subprocess
import urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
OUT = ROOT / 'review'
for folder in ['raw', 'sheets', 'frames']:
    (OUT / folder).mkdir(parents=True, exist_ok=True)
JOBS = json.loads((ROOT / 'today-100-jobs.json').read_text())
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
SMALL = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)

def run(args):
    return subprocess.run(args, capture_output=True, check=True)

def key_pixels(frame):
    # Same byte-domain threshold and despill as specialMoves.ts, at engine width.
    rgb = frame.astype(np.float32)
    dominance = np.minimum(rgb[:,:,1], rgb[:,:,2]) - rgb[:,:,0]
    alpha = 1 - np.clip((dominance - 35) / 65, 0, 1)
    partial = (alpha > 0) & (alpha < 1)
    for c in [1, 2]:
        spill = np.floor(rgb[:,:,c] * alpha + np.minimum(rgb[:,:,c], rgb[:,:,0] + 25) * (1 - alpha) + .5)
        rgb[:,:,c] = np.where(partial, spill, rgb[:,:,c])
    return np.dstack((rgb, np.floor(alpha * 255 + .5))).astype(np.uint8)

def composite(frame):
    rgba = key_pixels(frame)
    h, w = frame.shape[:2]
    yy, xx = np.indices((h, w))
    dark = np.where(((xx//18 + yy//18) % 2)[:,:,None], [39,43,56], [59,63,76])
    light = np.where(((xx//18 + yy//18) % 2)[:,:,None], [219,222,230], [242,243,247])
    bg = np.where((xx < w//2)[:,:,None], dark, light)
    a = rgba[:,:,3:4].astype(float)/255
    return Image.fromarray(np.clip(rgba[:,:,:3]*a + bg*(1-a),0,255).astype(np.uint8))

def audit(job):
    ident = job['catalogId']; path = OUT/'raw'/f'{ident}.mp4'
    if not path.exists():
        tmp = path.with_suffix('.part')
        req = urllib.request.Request(job['outputUrl'], headers={'User-Agent':'Squabblemon asset review'})
        with urllib.request.urlopen(req, timeout=90) as source, tmp.open('wb') as target:
            while data := source.read(1024*1024): target.write(data)
        tmp.replace(path)
    probe = json.loads(run(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(path)]).stdout)
    video = next(s for s in probe['streams'] if s['codec_type']=='video')
    audio = [s for s in probe['streams'] if s['codec_type']=='audio']
    duration = float(probe['format']['duration'])
    height = round(288*video['height']/video['width'])
    decoded = run(['ffmpeg','-v','error','-threads','1','-filter_threads','1','-i',str(path),'-an','-vf',f'fps=4,scale=288:{height}','-f','rawvideo','-pix_fmt','rgb24','-'])
    frames = np.frombuffer(decoded.stdout,dtype=np.uint8).reshape(-1,height,288,3)
    metrics = []
    for n, frame in enumerate(frames):
        alpha = key_pixels(frame)[:,:,3]/255
        edge = np.concatenate([alpha[:4].ravel(),alpha[-4:].ravel(),alpha[:, :4].ravel(),alpha[:,-4:].ravel()])
        metrics.append({'t':round(n/4,2),'opaqueFraction':round(float((alpha>.95).mean()),4),'clearFraction':round(float((alpha<.05).mean()),4),'edgeOpaqueFraction':round(float((edge>.95).mean()),4)})
    vol = run(['ffmpeg','-hide_banner','-threads','1','-i',str(path),'-vn','-af','volumedetect','-f','null','-']).stderr.decode(errors='replace') if audio else ''
    def volume(label):
        m=re.search(label+r': ([\-\w.]+) dB',vol)
        return float(m.group(1)) if m and m.group(1)!='-inf' else None
    flags=[]
    if not audio: flags.append('No audio stream')
    if volume('mean_volume') is None or volume('mean_volume') < -40: flags.append('Silent or very quiet audio')
    # Deliberate closeups/impact beats can trigger this; visual review decides.
    if max(m['opaqueFraction'] for m in metrics)>.92: flags.append('Near-full opaque frame: inspect background or closeup')
    if sum(m['edgeOpaqueFraction']>.65 for m in metrics)>len(metrics)*.3: flags.append('Frequent frame-edge content: inspect crop and scenery')
    expected=job.get('actualRequestedDurationSeconds')
    if expected and abs(duration-expected)>.4: flags.append('Duration differs from submitted request')
    if job.get('promptDurationReview'): flags.append('Review pacing: historical prompt duration mismatch')
    indices=np.linspace(0,len(frames)-1,8).round().astype(int)
    # Art reference plus eight uniformly sampled keyed frames, dark/light checker.
    tilew=168; tileh=round(tilew*height/288); top=47; bottom=22
    sheet=Image.new('RGB',(tilew*9,top+tileh+bottom),'#10131c'); draw=ImageDraw.Draw(sheet)
    draw.text((8,5),f"{ident} | {job['name']} | {job['move']} | {duration:.3f}s",font=FONT,fill='white')
    draw.text((8,27),'REFERENCE  /  engine cyan key, sampled at 4 fps; checker visible = transparency',font=SMALL,fill='#aab5ca')
    ref = REPO/'artifacts/squabblemon/public/assets/characters'/f'{ident}.webp'
    if ref.exists():
        im=Image.open(ref).convert('RGBA'); im.thumbnail((tilew,tileh))
        sheet.paste(im,((tilew-im.width)//2,top+(tileh-im.height)//2),im)
    draw.text((5,top+tileh+3),'Reference art',font=SMALL,fill='white')
    for col,idx in enumerate(indices,1):
        im=composite(frames[idx]).resize((tilew,tileh),Image.Resampling.LANCZOS)
        sheet.paste(im,(col*tilew,top))
        draw.text((col*tilew+5,top+tileh+3),f'{idx/4:.2f}s',font=SMALL,fill='white')
    sheet.save(OUT/'sheets'/f'{ident}.jpg',quality=90)
    # Keep representative lossless frames for comparisons against browser renderer.
    mid=int(indices[4]); Image.fromarray(frames[mid]).save(OUT/'frames'/f'{ident}-source.png')
    Image.fromarray(key_pixels(frames[mid])).save(OUT/'frames'/f'{ident}-keyed.png')
    return {'catalogId':ident,'name':job['name'],'move':job['move'],'generationId':job['generationId'],'sourceUrl':job['outputUrl'],'file':str(path),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'width':video['width'],'height':video['height'],'duration':duration,'fps':video['avg_frame_rate'],'codec':video['codec_name'],'audio':[{k:a.get(k) for k in ['codec_name','sample_rate','channels']} for a in audio],'meanVolumeDb':volume('mean_volume'),'peakVolumeDb':volume('max_volume'),'fullVideoDecode':'passed','flags':flags,'sampleMetrics':metrics,'visualReview':'pending','audioReview':'pending','accepted':False,'sheet':str(OUT/'sheets'/f'{ident}.jpg')}

if __name__=='__main__':
    by_id={}; errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures={pool.submit(audit,j):j for j in JOBS}
        for future in concurrent.futures.as_completed(futures):
            j=futures[future]
            try:
                result=future.result(); by_id[j['catalogId']]=result
                print(f"{len(by_id):03}/100 {j['name']}: {', '.join(result['flags']) or 'technical checks passed'}",flush=True)
            except Exception as e:
                errors.append({'catalogId':j['catalogId'],'error':str(e)}); print('ERROR',j['catalogId'],str(e),flush=True)
            (OUT/'technical-audit.json').write_text(json.dumps({'clips':list(by_id.values()),'errors':errors},indent=2)+'\n')
    ordered=[by_id[j['catalogId']] for j in JOBS if j['catalogId'] in by_id]
    (OUT/'technical-audit.json').write_text(json.dumps({'clips':ordered,'errors':errors},indent=2)+'\n')
    for i in range(0,len(ordered),4):
        sheets=[Image.open(x['sheet']) for x in ordered[i:i+4]]
        combined=Image.new('RGB',(sheets[0].width,sum(s.height for s in sheets)))
        y=0
        for s in sheets: combined.paste(s,(0,y)); y+=s.height
        combined.save(OUT/'sheets'/f'page-{i//4+1:02}.jpg',quality=91)
    print(json.dumps({'completed':len(ordered),'errors':errors,'totalBytes':sum(x['bytes'] for x in ordered)}),flush=True)
