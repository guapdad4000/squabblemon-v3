"""Import the supplied mechanics recording without rebuilding unrelated tutorial clips."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
app = root / 'artifacts/squabblemon'
manifest = json.loads((app / 'reference/dr-fade-mechanic-audio.json').read_text())
source = Path(sys.argv[1])
if hashlib.sha256(source.read_bytes()).hexdigest() != manifest['sha256']:
    raise SystemExit('The supplied recording does not match the mechanic source manifest.')
output = app / 'public/audio/voice/dr-fade/tutorial'
clips_path = app / 'src/lib/tutorialVoiceClips.json'
clips = json.loads(clips_path.read_text())
for cue in manifest['clips']:
    duration = cue['end'] - cue['start']
    filters = f'loudnorm=I=-16:TP=-1.5:LRA=9,afade=t=in:d=0.005,afade=t=out:st={duration-.02}:d=0.02'
    for extension, codec in [('ogg', ['-c:a', 'libvorbis', '-q:a', '4']), ('m4a', ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'])]:
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(cue['start']), '-t', str(duration), '-i', str(source), '-vn', '-af', filters, '-ar', '44100', '-ac', '1', *codec, str(output / f"{cue['id']}.{extension}")], check=True)
    revision = hashlib.sha256((manifest['sha256'] + json.dumps(cue, sort_keys=True)).encode()).hexdigest()[:12]
    clips = [clip for clip in clips if clip['id'] != cue['id']]
    clips.append({'id': cue['id'], 'text': cue['text'], 'duration': round(duration, 3), 'revision': revision})
clips_path.write_text(json.dumps(clips, indent=2, ensure_ascii=False) + '\n')
print('Imported 10 mechanic cues in Ogg and AAC.')
