import json, re, zipfile
from pathlib import Path
root = Path(__file__).resolve().parents[1]
app = root / 'artifacts/squabblemon'
script = app / 'scripts/story/chapters/block-party'
text = (root / 'lib/squabblemon-engine/src/chapterOneDialogue.ts').read_text(encoding='utf-8')
dialogue = json.loads(text.split('export default ', 1)[1].strip().removesuffix(';'))
assets = {line['portraitAssetId'] for sections in dialogue.values() for lines in sections.values() for line in lines}
assets |= {'assets/layered/'+name+'.webp' for name in ['corner-store','moon-rooftop','red-court','gold-alley','civic-summit','crown-court']}
out = root / 'artifacts/deliverables/Squabblemon_Chapter_One_2D_Kit_v1.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.write(script / '2D_BUILD_HANDOFF.md', 'START_HERE.md')
    archive.write(script / 'CHAPTER_ONE_READTHROUGH.md', 'script/CHAPTER_ONE_READTHROUGH.md')
    for scene in (script / 'scenes').glob('*.md'): archive.write(scene, 'script/scenes/'+scene.name)
    archive.writestr('script/dialogue.json', json.dumps(dialogue, ensure_ascii=False, indent=2))
    for asset in sorted(assets):
        path = app / 'public' / asset
        assert path.is_file(), asset
        archive.write(path, asset)
    for path in ['src/components/story/StoryStage.tsx','src/components/story/story-stage.css','src/pages/StoryStudio.tsx']:
        archive.write(app / path, 'presentation/'+Path(path).name)
    archive.writestr('ASSET_MANIFEST.json', json.dumps({'runtimeAssets': sorted(assets), 'artSource': 'existing project artwork', 'animation': 'CSS puppet motion; no video dependencies', 'knownLimit': 'Alley Runner shares Blue artwork; standalone courier concept needs alpha cleanup'}, indent=2))
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    print(json.dumps({'zip': str(out), 'files': len(archive.namelist()), 'megabytes': round(out.stat().st_size / 1024**2, 2), 'assets': len(assets)}))
