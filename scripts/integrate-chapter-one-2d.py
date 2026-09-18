"""Compile the approved screenplay without changing encounter rules or rewards."""
import json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'artifacts/squabblemon/scripts/story/chapters/block-party/scenes'
pattern = re.compile(r'lineToken: ("[^"\n]+")\s+speaker: ("(?:[^"\\]|\\.)*")\s+portraitAssetId: ("(?:[^"\\]|\\.)*")\s+text: ("(?:[^"\\]|\\.)*")')
data = {}
for path in sorted(source.glob('*.md')):
    for match in pattern.finditer(path.read_text(encoding='utf-8-sig')):
        token, speaker, portrait, text = map(json.loads, match.groups())
        node, section, index = token.split(':')
        if section not in ('pre', 'post', 'main'): continue
        rows = data.setdefault(node, {}).setdefault(section, [])
        assert int(index) == len(rows), token
        rows.append(dict(speaker=speaker, portraitAssetId=portrait, text=text))
assert sum(len(lines) for sections in data.values() for lines in sections.values()) == 106
target = ROOT / 'lib/squabblemon-engine/src/chapterOneDialogue.ts'
target.write_text('// Generated from the approved Chapter One screenplay.\nexport default '+json.dumps(data, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
print('Compiled 106 approved lines across', len(data), 'nodes')
