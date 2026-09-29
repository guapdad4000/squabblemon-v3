"""Build tutorial narration from the supplied ElevenLabs recording.

Usage: python3 scripts/prepare-dr-fade-tutorial-audio.py /path/to/source.mp3 [...]
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
if not sources:
    raise SystemExit('No source matched a SHA-256 in the manifest')
selected = [clip for clip in manifest['clips'] if clip['source'] in sources]
existing_path = APP / 'src/lib/tutorialVoiceClips.json'
existing = json.loads(existing_path.read_text())
output = APP / 'public/audio/voice/dr-fade/tutorial'
output.mkdir(parents=True, exist_ok=True)


def render(clip):
    source = sources[clip['source']]
    duration = (clip['end'] - clip['start']) / clip['speed']
    filters = (f"atempo={clip['speed']},loudnorm=I=-16:TP=-1.5:LRA=9,"
               f"afade=t=in:d=0.005,afade=t=out:st={max(0, duration-.015)}:d=0.015")
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
    rendered = list(pool.map(render, selected))
by_id = {clip['id']: clip for clip in existing}
by_id.update({clip['id']: clip for clip in rendered})
# Other narration libraries share this playback registry, but own their source
# manifests. A partial tutorial rebuild must not drop their working clip IDs.
for filename in ('dr-fade-mechanic-audio.json', 'dr-fade-welcome-pull-audio.json'):
    companion = json.loads((APP / 'reference' / filename).read_text())
    for cue in companion['clips']:
        if cue['id'] not in by_id:
            for extension in ('ogg', 'm4a'):
                if not (output / f"{cue['id']}.{extension}").is_file():
                    raise SystemExit(f"Missing companion audio: {cue['id']}.{extension}")
            by_id[cue['id']] = {
                'id': cue['id'],
                'text': cue['text'],
                'duration': round(cue['end'] - cue['start'], 3),
                'revision': hashlib.sha256(
                    (companion['sha256'] + json.dumps(cue, sort_keys=True)).encode()
                ).hexdigest()[:12],
            }
ordered = [clip['id'] for clip in manifest['clips']]
existing_path.write_text(json.dumps(
    [by_id[id] for id in ordered] + [clip for id, clip in by_id.items() if id not in ordered],
    indent=2, ensure_ascii=False,
) + '\n')
print(f"Rendered {len(rendered)} clips in Ogg and AAC; left all other sources unchanged")
