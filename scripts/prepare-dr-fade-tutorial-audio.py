"""Build tutorial narration from the supplied ElevenLabs recording.

Usage: python3 scripts/prepare-dr-fade-tutorial-audio.py /path/to/full.mp3 /path/to/pickups.mp3
Requires ffmpeg and ffprobe. The original recording is never modified.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'artifacts/squabblemon'
manifest = json.loads((APP / 'reference/dr-fade-tutorial-audio.json').read_text())
sources = {}
for argument in sys.argv[1:]:
    source = Path(argument)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    for key, details in manifest['sources'].items():
        if digest == details['sha256']:
            sources[key] = source
missing = set(manifest['sources']) - set(sources)
if missing:
    raise SystemExit('Missing or mismatched source recordings: ' + ', '.join(sorted(missing)))
output = APP / 'public/audio/voice/dr-fade/tutorial'
output.mkdir(parents=True, exist_ok=True)


def render(clip):
    source = sources[clip['source']]
    duration = (clip['end'] - clip['start']) / clip['speed']
    filters = (f"atempo={clip['speed']},loudnorm=I=-16:TP=-1.5:LRA=9,"
               f"afade=t=in:d=0.005,afade=t=out:st={max(0, duration-.02)}:d=0.02")
    for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']),
                             ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                        '-ss', str(clip['start']), '-t', str(clip['end']-clip['start']),
                        '-i', str(source), '-vn', '-af', filters, '-ar', '44100', '-ac', '1',
                        *codec, str(output / f"{clip['id']}.{extension}")], check=True)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                     'format=duration', '-of', 'csv=p=0', str(output / f"{clip['id']}.m4a")]))
    return {'id': clip['id'], 'text': clip['text'], 'duration': round(duration, 3), 'revision': hashlib.sha256((manifest['sources'][clip['source']]['sha256'] + json.dumps(clip, sort_keys=True)).encode()).hexdigest()[:12]}


with ThreadPoolExecutor(max_workers=4) as pool:
    clips = list(pool.map(render, manifest['clips']))
(APP / 'src/lib/tutorialVoiceClips.json').write_text(json.dumps(clips, indent=2, ensure_ascii=False)+'\n')
print(f"Rendered {len(clips)} clips in Ogg and AAC; main script: {sum(c['duration'] for c in clips[:40]):.1f}s")
