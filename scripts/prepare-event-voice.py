"""Split the supplied five-line ElevenLabs recording into game cues.

Usage: python3 scripts/prepare-event-voice.py /path/to/recording.mp3
Requires ffmpeg and ffprobe. Keeps the source unchanged and preserves its pace.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'artifacts/squabblemon'
manifest = json.loads((APP / 'reference/event-voice.json').read_text())
source = Path(sys.argv[1])
if hashlib.sha256(source.read_bytes()).hexdigest() != manifest['sha256']:
    raise SystemExit('This recording does not match the aligned source manifest.')
output = APP / 'public/audio/voice/dr-fade/events'
output.mkdir(parents=True, exist_ok=True)
for clip in manifest['clips']:
    duration = clip['end'] - clip['start']
    filters = f'loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.005,afade=t=out:st={duration-.02}:d=0.02'
    for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                             ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-ss', str(clip['start']), '-t', str(duration), '-i', str(source),
                        '-vn', '-af', filters, '-ar', '44100', '-ac', '1',
                        *codec, str(output / f"{clip['id']}.{extension}")], check=True)
    print(f"{clip['id']}: {duration:.2f}s")
