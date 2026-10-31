#!/usr/bin/env python3
"""Refresh delivery hashes after encoding; source artwork hashes are untouched."""
from pathlib import Path
from hashlib import sha256
import json
ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'artifacts/squabblemon/public'
def stamp(entry,path):
    data=path.read_bytes()
    entry.update(sha256=sha256(data).hexdigest(),bytes=len(data))
for name in ['anunaki-drawn-animation-sources','anunaki-future-media','anunaki-special-moves-media']:
    p=ROOT/f'docs/events/{name}.json'
    data=json.loads(p.read_text())
    if name=='anunaki-drawn-animation-sources':
        for asset in data['assets']:
            for file in asset['files']: stamp(file,PUBLIC/file['path'])
    elif name=='anunaki-future-media':
        for asset in data['assets']: stamp(asset,PUBLIC/asset['asset'])
    else:
        for clip in data['clips']: stamp(clip,PUBLIC/f"assets/special-moves/anunaki-{clip['name']}-v1.mp4")
    data['deliveryOptimization']='See docs/events/anunaki-media-optimization.json for retained input hashes, output hashes and encoding settings. Source art, dimensions and authored timing are unchanged.'
    if name=='anunaki-future-media': data['encoding']='WebP quality 80, method 6 from retained pre-optimization derivatives; original dimensions and framing preserved.'
    p.write_text(json.dumps(data,indent=2)+'\n')

# Video URLs are revisioned by content; compression must invalidate cached bytes.
p=ROOT/"artifacts/squabblemon/src/specialMoves.json"
data=json.loads(p.read_text())
for clip in data["clips"].values():
    if clip["file"].startswith("anunaki-"):
        clip["revision"]=sha256((PUBLIC/"assets/special-moves"/clip["file"]).read_bytes()).hexdigest()[:16]
p.write_text(json.dumps(data,indent=2)+"\n")
