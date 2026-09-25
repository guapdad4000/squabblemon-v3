"""Cut the supplied round/turn recording and standalone final-round take.

Usage: python3 scripts/prepare-battle-announcer.py /path/to/rounds.mp3 /path/to/final.mp3
Requires ffmpeg. Source recordings are verified and never changed.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

APP = Path(__file__).resolve().parents[1] / 'artifacts/squabblemon'
manifest = json.loads((APP / 'reference/battle-announcer.json').read_text())
sources = [Path(value) for value in sys.argv[1:]]
if len(sources) != 2:
    raise SystemExit(__doc__)
for source, expected in zip(sources, manifest['sources']):
    if hashlib.sha256(source.read_bytes()).hexdigest() != expected['sha256']:
        raise SystemExit(f'Source does not match the aligned recording: {source.name}')
output = APP / 'public/audio/voice/dr-fade/battle'
output.mkdir(parents=True, exist_ok=True)
for clip in manifest['clips']:
    duration = clip['end'] - clip['start']
    filters = f'loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.005,afade=t=out:st={duration-.02}:d=0.02'
    for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                             ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-ss', str(clip['start']), '-t', str(duration), '-i', str(sources[clip['source']]),
                        '-vn', '-af', filters, '-ar', '44100', '-ac', '1',
                        *codec, str(output / f"{clip['id']}.{extension}")], check=True)
    print(f"{clip['id']}: {duration:.2f}s")
