from pathlib import Path
from PIL import Image
import csv, hashlib, html, json, re, shutil, zipfile

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'artifacts/squabblemon/public/assets'
STORY=ROOT/'artifacts/squabblemon/scripts/story'
OUT=ROOT/'artifacts/deliverables/Squabblemon_Chapter_One_Video_Agent_Pack_v1'
OUT.mkdir(parents=True,exist_ok=False)
records=[]

def write(rel,text):
    p=OUT/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text,encoding='utf-8');return p

def copy(src,rel,role,notes=''):
    p=OUT/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,p)
    row={'path':rel,'role':role,'notes':notes,'source':str(src.relative_to(ROOT)).replace('\\','/') if src.is_relative_to(ROOT) else src.name}
    if p.suffix.lower() in ['.png','.webp','.jpg']:
        with Image.open(p) as im:
            row.update(width=im.width,height=im.height,mode=im.mode)
            if 'A' in im.getbands():row['alpha_range']=list(im.getchannel('A').getextrema())
    records.append(row);return rel

# Copy the revised writing with its relative links intact.
for p in STORY.rglob('*.md'):
    if 'template' in p.name.lower() or p.name=='WRITER_KICKOFF.md':continue
    copy(p,'01_SCRIPT/'+p.relative_to(STORY).as_posix(),'revised screenplay / continuity')

cast=['ganger-blue','ganger-red','cracked-head','snitch','cornball','wifey','baby-momma','og-uncle']
for name in cast:
    copy(ASSETS/'characters'/f'{name}.webp',f'02_CHARACTER_ART/{name}.webp','current game character reference',
         'Future-season continuity only; no Chapter One speaking scene.' if name=='og-uncle' else 'Existing identity reference; new animation poses are not included.')

venues=['corner-store-court','harbor-skyline-court','red-fence-night-court','civic-hill-climb','crown-rooftop-court']
for name in venues:
    copy(ASSETS/'venues'/f'{name}.webp',f'03_BACKGROUNDS/ACTUAL_STORY_BATTLE/{name}.webp','actual story battle background',
         'Exact current storyEncounter battlefield reference. Tall gameplay composition; not an eye-level cinematic plate.')

landscapes=['corner-store','moon-rooftop','red-court','civic-summit','crown-court','gold-alley','red-alley','sunset-block','festival-street']
source_map={e['name']:e['source'] for e in json.loads((ASSETS/'layered/sources.json').read_text())['environments']}
for name in landscapes:
    source=Path('E:/Downloads/openart-download (3)')/source_map[name]
    if not source.exists():raise FileNotFoundError(source)
    copy(source,f'03_BACKGROUNDS/LANDSCAPE_WALLPAPERS/{name}.png','original landscape wallpaper / cinematic look reference',
         'Original supplied PNG; not upscaled. Composition differs from the actual story battle plate. Relight/restage for the shot brief; do not treat as an exact matching reverse angle.')

for name in ['deck-stack','portable-speaker','sticker-phone','championship-chain','foil-pack','neighborhood-map']:
    copy(ASSETS/'props'/f'{name}.webp',f'04_PROP_REFERENCES/{name}.webp','existing prop design reference',
         'The chain is not the scripted plastic Crown; speaker is not an air fryer. Preserve distinction.' if name in ['championship-chain','portable-speaker'] else '')
for name in ['cast','landscape-backgrounds','props']:
    copy(ROOT/'artifacts/video-handoff-audit'/f'{name}.jpg',f'00_START_HERE/{name}-contact-sheet.jpg','labeled inspection thumbnails',
         'Preview only. Animate from the full-resolution files. Props preview includes a collection-box reference not needed in this chapter.')

node_ids=['welcome-to-the-block','blue-side-pressure','receipts-on-camera','red-side-retaliation','side-alley-challenge','snitch-at-the-corner','cracked-head-takes-the-block','block-crowned']
scene_files=sorted((STORY/'chapters/block-party/scenes').glob('*.md'))
portrait_ids={'Ganger Blue':'ganger-blue','Ganger Red':'ganger-red','Cracked Head':'cracked-head','Snitch':'snitch','Cornball':'cornball','Wifey':'wifey','Baby Momma':'baby-momma','Alley Runner':None}
scene_venues=[venues[0],venues[1],venues[2],venues[2],venues[0],venues[3],venues[4],venues[4]]
scene_landscapes=[['corner-store','sunset-block'],['moon-rooftop'],['red-court'],['red-court'],['corner-store','gold-alley','red-alley'],['civic-summit'],['crown-court'],['crown-court']]
all_lines=[];scenes=[];clips=[]
line_pattern=r'  - lineToken: ("[^"\r\n]+")\s+speaker: ("[^"\r\n]+")\s+portraitAssetId: ("[^"\r\n]+")\s+text: ("[^\r\n]+")'
for i,p in enumerate(scene_files):
    text=p.read_text(encoding='utf-8-sig')
    node=node_ids[i]
    assert f'nodeId: "{node}"' in text
    lines=[]
    for token,speaker,portrait,spoken in re.findall(line_pattern,text):
        token,speaker,spoken=json.loads(token),json.loads(speaker),json.loads(spoken)
        section=token.split(':')[-2]
        row={'scene':i+1,'node_id':node,'token':token,'section':section,'speaker':speaker,'text':spoken,
             'character_art':f'02_CHARACTER_ART/{portrait_ids[speaker]}.webp' if portrait_ids[speaker] else '',
             'art_status':'existing identity reference' if portrait_ids[speaker] else 'DEDICATED ART MISSING; game borrows Blue portrait, not an approved distinct identity'}
        lines.append(row);all_lines.append(row)
    stage=re.search(r'\*\*Dramatic purpose:\*\* [^\n]+\n\n(.*?)\n\n```yaml',text,re.S).group(1)
    exit_text=re.search(r'\*\*Exit:\*\* (.*?)\n\n## 3',text,re.S).group(1)
    data={'scene':i+1,'id':node,'title':text.splitlines()[0][2:],'script':'01_SCRIPT/chapters/block-party/scenes/'+p.name,
          'optional':i==4,'battle_background':f'03_BACKGROUNDS/ACTUAL_STORY_BATTLE/{scene_venues[i]}.webp',
          'landscape_references':[f'03_BACKGROUNDS/LANDSCAPE_WALLPAPERS/{n}.png' for n in scene_landscapes[i]],
          'cast':list(dict.fromkeys(l['speaker'] for l in lines)),'stage':stage,'exit':exit_text,'lines':lines}
    scenes.append(data)
    for section in ['pre','post','main']:
        section_lines=[l for l in lines if l['section']==section]
        if not section_lines:continue
        clip_id=f'ch01_s{i+1:02d}_{section}'
        clips.append({'clip_id':clip_id,'scene':i+1,'node_id':node,'section':section,'line_tokens':[l['token'] for l in section_lines],
                      'play_condition':'before player starts battle' if section=='pre' else 'only after verified victory' if section=='post' else 'after final boss victory; ceremony',
                      'next_action':'RETURN CONTROL TO GAME FOR REAL CARD FIGHT' if section=='pre' else 'return to game reward/progression flow',
                      'duration':'derive from recorded performance; do not force full dialogue into 6.4 seconds'})

assert len([x for x in all_lines if x['section']!='defeat'])==106
assert len(clips)==15
write('05_VIDEO_JOBS/dialogue.json',json.dumps(all_lines,ensure_ascii=False,indent=2))
write('05_VIDEO_JOBS/clips.json',json.dumps(clips,ensure_ascii=False,indent=2))
write('05_VIDEO_JOBS/scenes.json',json.dumps(scenes,ensure_ascii=False,indent=2))
with (OUT/'05_VIDEO_JOBS/dialogue.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(all_lines[0]));w.writeheader();w.writerows(all_lines)

# Each shot is a unit the video agent can generate independently.
shot_specs=[
 [('pre',0,0,'Wide push-in','Reveal dead karaoke mic and vending-machine press conference.'),('pre',1,3,'Blue/Cornball two-shot','Blue inspects the newcomer; Cornball indicts the covered OPEN sign.'),('pre',4,7,'Alternating medium and reaction','Challenge terms, district rule, bass-in-the-car roast. Finish on deck/table handoff.'),('post',0,3,'Medium reaction, then prop insert','Blue swallows the loss; jacket yanks off sign; drink drops halfway and stops.')],
 [('pre',0,3,'Wide throne reveal into Wifey close-up','Wifey dismantles folding-chair royalty and exposes bathroom electricity.'),('pre',4,6,'Low Blue angle interrupted by Wifey','Crown is scheduling authority, not ownership; hold the puncture of his grandeur.'),('post',0,3,'Shared medium with board insert','Wifey writes the result in ink; Blue redirects embarrassment toward Red.'),('post',None,None,'Silent button shot','Chair creaks; Blue carries cables; hair dryer flickers the lights.')],
 [('pre',0,2,'Wide fake courtroom into phone insert','Thumb joke; ring-light adjustment; Red demands both sides in frame.'),('pre',3,6,'Barrier insert and alternating close-ups','State actual middle-district round-two rule, then courtroom roast and challenge.'),('post',0,3,'Phone close-up, then Red reaction','Snitch pitches humiliating title; Red insists on keeping the whole match.'),('post',None,None,'Silent payoff','Ring light rotates back to table; kitchen timer rings, no food.')],
 [('pre',0,2,'Two-shot with untouched paper plate','Auntie cookout ban and Blue community-outreach roast.'),('pre',3,6,'Notebook insert and held Blue reaction','Memorial program appears; keep Cracked Head portrait consistent with supplied art. Comedy gives way to hurt.'),('pre',7,7,'Red returns to the table','One more match and late pressure. Cut to real gameplay.'),('post',0,4,'Medium exchange into paper insert','Signed entry, memorial boundary, Blue leaves; Red conceals recording sleeve without comic sting.')],
 [('pre',0,3,'Wide alley with prop inserts','Courier table and full vending-machine investigation; display window versus retrieval flap.'),('pre',4,5,'Runner medium','Optional match; cosmetic reward; no main-route promise.'),('post',0,4,'Shared medium and dry reactions','Tag earned; lukewarm revenge; Snitch warning; birthday-post joke.'),('post',None,None,'Silent product-label reaction','Unsweetened sparkling-water revelation; sugar packet offered and pocketed.')],
 [('pre',0,3,'Low media-desk reveal','Reveal Snitch sitting on unopened air-fryer box; Red demands sheet and source.'),('pre',4,7,'Phone insert, then two-shot','Returning-customer evasion and exact round-four +2 Motion warning.'),('post',0,4,'Tight dialogue coverage','Slot posted; other finalist identity withheld; voice-note/deposit contract gag.'),('post',None,None,'Hold on stair landing, no entrant face','Broken organ flourish and footsteps; Red stills; Snitch grabs phones. Reveal belongs in Scene 7.')],
 [('pre',0,4,'Grand entrance wide, then held Blue close-up','Gift-wrap carpet, fish-fry smoke, organ/BATTERY LOW; Blue recognizes brother and erupts over memorial shirts.'),('pre',5,8,'Triangular coverage','Red demands camera down; Snitch has two phones; Blue names four-year absence.'),('pre',9,11,'Rival medium into empty finalist chair','Cracked claims block; Red upholds player-earned chair; challenge into gameplay.'),('post',0,3,'Winner-space wide, then brothers close-up','Cracked honors defeat; church-calendar roast; let four-year wound land.'),('post',4,6,'Red arbitrates, then silent button','Result stands, future challenge under common rules; rejected handshake, accidental applause unplugged.')],
 [('main',0,4,'Ceremony wide and comic prop inserts','Plastic Crown on neck pillow; shared schedule; Blue offers lights; Snitch stages group shot.'),('main',5,8,'Entrance insert into Baby Momma medium','Ring light disconnected; camera boundary; dead-man-in-VIP line; Cracked starts excuse.'),('main',9,11,'Keep Baby Momma commanding the frame','Address/pizza-man roast and smoke/church-organ takedown. Do not reveal child.'),('main',12,15,'Recording envelope insert, then reaction triangle','Red admits four-year recording. Baby Momma makes them put the chairs back.'),('main',None,None,'Held final tableau','Chair redirected to Red, Wifey sets water, phone face down. Cut before recording plays; Crown remains with player.')]
]
shots=[]
for i,specs in enumerate(shot_specs):
    scene=scenes[i]
    for j,(section,start,end,camera,action) in enumerate(specs):
        shot_id=f'ch01_s{i+1:02d}_{section}_sh{j+1:02d}'
        tokens=[] if start is None else [f'{scene["id"]}:{section}:{n}' for n in range(start,end+1)]
        for token in tokens:assert any(l['token']==token for l in scene['lines']),token
        shots.append({'shot_id':shot_id,'clip_id':f'ch01_s{i+1:02d}_{section}','camera':camera,'action':action,'line_tokens':tokens,
                      'duration':'performance-led; split into smaller generations if needed; silent beat typically 2–4 s'})
write('05_VIDEO_JOBS/shotlist.json',json.dumps(shots,ensure_ascii=False,indent=2))
with (OUT/'05_VIDEO_JOBS/shotlist.csv').open('w',encoding='utf-8-sig',newline='') as f:
    w=csv.DictWriter(f,fieldnames=list(shots[0]));w.writeheader();w.writerows({**s,'line_tokens':' | '.join(s['line_tokens'])} for s in shots)

for scene in scenes:
    i=scene['scene']
    job=f'# Scene {i:02d}: {scene["title"]}\n\n'
    job+='Create a heightened illustrated neighborhood comedy-drama sequence using the supplied character identities. Follow 00_START_HERE/PRODUCTION_BRIEF.md and ART_DECISIONS.md. Preserve the exact dialogue in the attached script. Animate short shots, then assemble separate pre-fight and victory clips; never generate the playable battle.\n\n'
    job+=f'**Script:** [{scene["title"]}](../{scene["script"]})\n\n**Exact gameplay venue:** [battle reference](../{scene["battle_background"]})\n\n'
    job+='**Landscape look references:** '+', '.join(f'[{Path(a).stem}](../{a})' for a in scene['landscape_references'])+'\n\n'
    job+='**Cast:** '+', '.join(scene['cast'])+'.\n\n'
    if i==5:job+='**Art blocker:** Alley Runner has no unique approved portrait. Current game borrows Blue. Build an explicitly provisional distinct courier design before final rendering; do not imply Runner is Blue. This optional scene can follow any later main-route scene.\n\n'
    if i==8:job+='**Pose requirement:** Baby Momma appears without a stroller or visible child in this scene. Use her supplied face/costume identity; create a new pose, rather than pasting the reference stroller into the entrance.\n\n'
    job+='## Staging\n\n'+scene['stage']+'\n\n## Shot plan\n\n'
    for shot in [s for s in shots if s['clip_id'].startswith(f'ch01_s{i:02d}_')]:
        job+=f'### {shot["shot_id"]}\n\n{shot["camera"]}. {shot["action"]}\n\n'
        for token in shot['line_tokens']:
            l=next(l for l in scene['lines'] if l['token']==token)
            job+=f'**{l["speaker"]}:** {l["text"]}\n\n'
    job+='## Exit\n\n'+scene['exit']+'\n\n## Exports\n\n'
    for c in [c for c in clips if c['scene']==i]:job+=f'- `{c["clip_id"]}_16x9.mp4` and `{c["clip_id"]}_9x16.mp4`; {c["play_condition"]}.\n'
    job+='\nAlso deliver text-free visuals, editable shot sources, first/last frames, separate dialogue/music/effects, and captions aligned to the final voice track. No fake timed captions or gameplay renders.\n'
    write(f'05_VIDEO_JOBS/SCENE_{i:02d}_{scene["id"]}.md',job)

write('00_START_HERE/PRODUCTION_BRIEF.md', '''# Squabblemon — Chapter One video production brief

## Make a playable episode

Create the cutscenes around seven real card battles. Produce 15 normal clips: seven pre-fight, seven victory-aftermath, one ceremony. Scene 5 is optional. The game—not generated video—runs each battle, determines its result, and grants rewards. Never make one uninterrupted movie that automatically assumes the player wins.

Start with Scene 01 as the pilot: identity frame, short establishing shot, opening argument, transition into game, victory aftermath. Establish consistent faces, outfits, framing, and original voices there before rendering the whole chapter. The remaining seven job sheets are ready afterward.

## Tone and visual approach

Oversized neighborhood comedy and family melodrama in the supplied illustrated fantasy-street game aesthetic. Folding-chair royalty, air-fryer journalism, a vending-machine investigation, a dead champion with a broken entrance cue, and a woman who can seize a rooftop with one sentence. Characters believe their own ridiculous behavior. Follow the game's actual illustrated designs; do not replace them with generic live-action people.

Use layered scenic depth, expressive staged characters, small secondary motion, inserts, reaction close-ups, and selective camera moves. Maintain face, hair, skin tone, mask, costume, jewelry, proportions, and distinguishing props across shots. Existing cutouts are identity references, not a complete animation rig. If a mask hides the mouth, use eyes, head and body acting; do not invent an uncovered face for lip sync.

The art contains fantasy armor, masks, exaggerated props, and supernatural-looking venue effects. Treat these as the world's visual language. Cracked Head's story return is literal survival, not resurrection, even though his reference design looks monstrous. His entrance smoke comes from food preparation. 'Hoodie' in dialogue is a gag; do not discard the actual reference costume to match it literally.

## Priority and timing

1. Exact revised dialogue and reveal order.
2. Correct character identity and scene location.
3. Readable reactions and comic timing.
4. Extra camera/particle spectacle.

Dialogue length dictates scene duration. Six-second stage movements in the writer files are establishing moves, NOT deadlines for the complete exchange. Generate short shots and edit them together. Hold after the roast; let grief land before the next joke. No forced all-at-once narration of stage directions.

## Landscape and phone delivery

Master direction: 1920×1080, 24 fps, H.264 MP4 for previews/runtime review. Recompose a separate 1080×1920 portrait version, not a blind center crop. Existing source wallpapers are near 16:9 at 1424×800; exact source dimensions are in the manifest. They are not 4K masters. Preserve the whole composition rather than stretching it. Produce higher-resolution final frames only as newly rendered output, never label an upscale an original.

Keep captions and key gestures away from the outer 8% frame edge; keep the lower 22% usable for in-game subtitles/controls. Favor alternating close-ups on phone rather than squeezing five bodies into frame. Deliver clean versions without baked subtitles, fake buttons, game stats, or decorative gibberish. Add captions as a separate SRT/VTT only after real audio timing exists. Provide a review version with captions if useful.

Per clip deliver MP4, opening and closing PNG frame, separate dialogue/music/effects WAV stems when audio is produced, and editable shot/project sources. For interactive dialogue, also provide text-free silent idle/reaction loops of approximately 4–8 seconds so the game can hold at player-controlled reading beats. Provide PNG character/prop layers where the production tool supports them. PNG format conversion is acceptable; never flatten away transparency inadvertently.

## Sound and voices

Use distinct original voices suited to these characters, with conversational rhythm and room for interruption. No imitation of a named performer is required. The packet contains written voice direction and script, not recorded voice performances, music, or licensed sound files. Produce/select those as separate work and list what was used.

Key cues: neighborhood crowd, dead-mic handling, folding-chair creak, hair-dryer/light flicker, obnoxious kitchen timer, vending-machine click, organ flourish interrupted by BATTERY LOW, accidental applause cut short, ring-light power disconnect, and final silence. Keep the organ/joke separate from the genuine hurt in Blue's reaction. Avoid repetitive canned laughter.

## Story conditions

Pre clips end before the fight. Post clips play only after a verified win. Defeat lines are optional alternate hooks, never replacements for a canonical victory line. All legal boss wins share the same ending; three stars change rewards, not family truth. Scene 5 can be skipped or played after the ceremony. No required clue or ceremony prop may depend on playing it.

Cracked Head returns openly in Scene 7 of Chapter One. Red knew he survived; Blue did not. Baby Momma's child's paternity is later chapter information; no child/stroller in Scene 8 staging, no second pregnancy. Cut before the old recording plays. The final key reward does not mean Chapter Two is currently playable.

## Start files

Read the full chapter at ../01_SCRIPT/chapters/block-party/CHAPTER_ONE_READTHROUGH.md, then ART_DECISIONS.md, then ../05_VIDEO_JOBS/SCENE_01_welcome-to-the-block.md. Use ../05_VIDEO_JOBS/dialogue.json for exact line IDs and text. All file paths are relative to the extracted packet root unless a link explicitly says otherwise.
''')

write('00_START_HERE/ART_DECISIONS.md','''# Art decisions and remaining production work

## What is authoritative

02_CHARACTER_ART contains the current named game art. These seven Chapter One identities were visually inspected: Blue (blue bandana, cap, long dark coat), Red (red hair/scarf/coat), Cracked Head (masked, ragged, heavily accessorized creature-like silhouette), Snitch (cap and tan trench coat), Cornball (literal corn/clown visual design), Wifey (dark clothing, pale coat, braids and handbag), Baby Momma (dark clothing, pale jacket, stroller in reference). OG Uncle is included for continuity only and does not speak in Chapter One.

Characters have alpha channels but some cutouts contain fringe/shadow residue. Treat as identity reference; inspect edges before compositing. Do not claim clean multi-pose animation sheets were supplied. Preserve Cornball's existing extravagant design instead of turning him into a generic man in street clothes.

## Alley Runner is not Blue

There is no unique Alley Runner portrait in the game. It currently points to ganger-blue.webp. The packet deliberately does not duplicate that file under a misleading new name. Scene 5 needs a provisional courier identity, distinct from Blue, consistent with the character bible. Mark it for design review before final delivery. Complete the other scenes while this design is pending.

## Background selection

03_BACKGROUNDS/ACTUAL_STORY_BATTLE holds the exact five battlefield plates explicitly selected by current story encounters. They use tall, stylized gameplay layouts. They are the continuity reference for what the player sees during a fight; do not use a mirrored overhead floor as an eye-level dialogue shot.

03_BACKGROUNDS/LANDSCAPE_WALLPAPERS holds nine original supplied PNGs, named clearly. These are usable landscape wallpapers and cinematic look references, not matched camera angles of those five battle plates. Use the per-scene mappings in scenes.json. Build/relight matching eye-level dialogue views as needed. Keep dusk/night progression coherent: the opening is late afternoon but the available corner-store landscape is night; the crown landscape is golden daylight but the finale is night. Do not silently switch time of day between two lines.

The legacy 540×960 story environments and old MP4 cinematics were deliberately excluded. Inspection found abstract magical imagery and settings that do not match this revised script. Their filenames alone are not a reason to use them.

## Props and poses still to create

Existing separate refs: deck stack, portable speaker, sticker phone, championship chain, pack, map. The chain does NOT replace the plastic Crown gag. The speaker does NOT replace an air-fryer box. No ready-made background planes, facial expression sets, rigged characters, or voice/audio tracks are supplied.

Create: vending machine with trapped drink/retrieval flap, dead karaoke mic, OPEN/VIP signs, gold sash and folding-chair throne, extension cable/box, kitchen timer, maintenance barrier, paper plate, memorial program using the correct Cracked Head identity, notebook and recording sleeve, courier bag and clipboard, sparkling-water label/sugar packet, ring light, unopened air-fryer carton/media signage, two phones, gift-wrap carpet, plastic Crown/neck pillow, scheduling board, paper cups, water bottles and chair-pull pose.

Baby Momma's reference includes a stroller. For Scene 8 create a new pose without stroller/child while retaining her identity. Avoid revealing paternity through an invented baby close-up. Preserve masks and unusual silhouettes in every re-pose. Render legible prop writing in compositing instead of relying on generated lettering.

## Scope of this packet

Source art is copied unchanged; no new production poses or missing backgrounds have been secretly generated. Contact sheets are labeled thumbnail previews. Original wallpaper filenames are mapped in ASSET_MANIFEST.json, without exposing the user's personal folder layout. This is a complete organized input handoff with explicit production gaps, not a claim of finished animation assets.
''')

write('00_START_HERE/AGENT_PROMPT.txt','''Create the Chapter One cutscenes for Squabblemon from this packet. First read PRODUCTION_BRIEF.md and ART_DECISIONS.md in 00_START_HERE, then the full revised read-through in 01_SCRIPT/chapters/block-party. Start production with SCENE_01_welcome-to-the-block.md in 05_VIDEO_JOBS. Preserve the supplied named character identities, exact spoken lines, outrageous neighborhood comedy, reaction timing, and underlying family hurt. Use the scene-specific background references. Produce separate pre-fight and victory clips with a clean handoff into real card gameplay; do not generate or fake the gameplay. Work in short shots rather than one long generation. Deliver 16:9 and separately composed 9:16, text-free versions, poster frames, editable sources, and audio stems/captions when recorded. Follow the missing-art notes, especially Alley Runner's unapproved identity and Baby Momma's stroller-free ceremony pose. Begin with the opening pilot and keep its design/voices consistent across the remaining scene jobs. Do not render the chapter's confidential recording contents or invent a Chapter Two cutscene.
''')

write('06_GAMEPLAY_HANDOFF/FIGHT_BREAKS.md','''# Where the game takes over

Required route: 01 → 02 → 03 → 04 → 06 → 07 → 08. Optional 05 branches after 02 and never gates another scene.

Each pre-fight clip ends with the challenge. Freeze a clean final frame, reveal the game's existing fight control/briefing, and run the real card match. Do not generate simulated cards, scores, win conditions, rewards, or combat outcomes in the movie. After server-confirmed victory, play the matching post clip. After defeat, return to retry with optional defeat dialogue. Scene 08 is ceremony only.

| Scene | Fight | Preserve |
| --- | --- | --- |
| 01 | Ganger Blue, guided | Two districts are enough to win. |
| 02 | Ganger Blue, standard | Tempo/commitment; no new narrative modifiers. |
| 03 | Ganger Red, rule twist | Existing round-two middle-district lock, both sides; existing starting Motion and lane bonus. |
| 04 | Ganger Red, standard | Existing CPU starting Motion and round-four pressure. |
| 05 | Alley Runner, optional mastery | Movement opponent; cosmetic reward; no vending-machine enemy. |
| 06 | Snitch, mini-boss | Watching the Feed: one-time +2 CPU Motion at round 4. |
| 07 | Cracked Head, boss | Existing three one-time phases; dialogue cues are optional additions. |
| 08 | No fight | Existing ceremony rewards only. |

Chapter One retains six required battles and one optional battle, 775 total street-xp from required fights, seven possible first-perfect-clear tickets plus one ceremony ticket. The scene text must not promise an unconfigured character unlock. No generated video may advance progress on its own.

Normal dialogue: 106 lines across eight scenes, including 11 on optional route; required-only route is 95. Seven optional defeat lines appear in dialogue.json; three optional boss-phase lines remain in the read-through. The game integration pass must separately handle saved dialogue IDs/content migration and keep player progress/reward claims intact.
''')

# Describe every package asset and add file-integrity inventory after writing docs/gallery.
write('ASSET_MANIFEST.json',json.dumps(records,ensure_ascii=False,indent=2))
write('00_READ_ME_FIRST.md','''# Squabblemon — Chapter One video-agent pack

This ZIP is the revised outrageous comedy-drama screenplay plus matching existing game art, original landscape wallpapers, exact scene/line mappings, and video-agent production jobs.

1. Extract the entire ZIP; keep the folders together.
2. Open INDEX.html for a visual asset browser.
3. Give the video agent 00_START_HERE/AGENT_PROMPT.txt, PRODUCTION_BRIEF.md, ART_DECISIONS.md and the full script.
4. Start with Scene 01 and its named character/background references. If your tool cannot read ZIPs, upload that small set directly rather than every image at once.
5. Generate short shots, assemble separate before-fight/after-victory clips, and leave actual card fights to the game.

Included: eight complete scene scripts and nine character bibles; eight identity images (seven unique Chapter One identities plus OG Uncle); five actual gameplay backgrounds; nine original landscape PNG wallpapers; six prop references; 15 normal clip definitions; shotlist and exact dialogue in CSV/JSON; missing-art notes.

Alley Runner has no unique approved art yet. Other missing items include new expressions/poses, comedy props, matched eye-level/relit environment views, and recorded audio. These are explicit video-production tasks, not disguised placeholders. Old mismatched story backgrounds and movie placeholders are excluded.

The numbered writing folder keeps its source links intact. Engineering references in those writer documents describe the game project; the portable production jobs and FIGHT_BREAKS.md contain what the video agent needs without the repository. The packet does not include private account files, credentials, or game backend data.
''')

cards=[]
for r in records:
    if r.get('width') and not r['path'].startswith('00_START_HERE'):
        a=html.escape(r['path'],quote=True)
        cards.append(f'<a class="card" href="{a}"><img loading="lazy" src="{a}" alt="{html.escape(Path(r["path"]).stem)}"><b>{html.escape(Path(r["path"]).stem)}</b><span>{html.escape(r["role"])} · {r["width"]} × {r["height"]}</span></a>')
job_links=''.join(f'<li><a href="05_VIDEO_JOBS/SCENE_{s["scene"]:02d}_{s["id"]}.md">{s["scene"]:02d} — {html.escape(s["title"])}</a></li>' for s in scenes)
write('INDEX.html','''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Squabblemon · Video Agent Pack</title><style>body{margin:0;background:#12131a;color:#eee;font:16px/1.6 system-ui,sans-serif}main{max-width:1280px;margin:auto;padding:40px 24px}h1{font-size:clamp(32px,5vw,66px);line-height:1.05;color:#f4c454;margin-bottom:12px}h2{margin-top:40px}a{color:#f4c454}.lead{max-width:900px;color:#c6c8d4}.tag{font-size:12px;letter-spacing:3px;color:#d0a966}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}.card{display:flex;flex-direction:column;background:#20232d;border:1px solid #343844;border-radius:12px;padding:12px;text-decoration:none}.card img{width:100%;height:240px;object-fit:contain;background:repeating-conic-gradient(#30333c 0 25%,#292c35 0 50%) 0/24px 24px;border-radius:6px}.card b{margin-top:10px}.card span{font-size:12px;color:#afb5c8}.notice{padding:18px;border-left:4px solid #f4c454;background:#262228}li{margin:6px 0}</style><main><div class="tag">BLOCK PARTY · CHAPTER ONE · PRODUCTION HANDOFF</div><h1>The whole block.<br>One very messy evening.</h1><p class="lead">Eight scenes, seven real card fights, fifteen cinematic segments. Revised script, current character identities, exact battle backgrounds, original landscape wallpapers, and shot-by-shot production jobs.</p><p><a href="00_START_HERE/PRODUCTION_BRIEF.md">Production brief</a> · <a href="00_START_HERE/ART_DECISIONS.md">Art decisions and gaps</a> · <a href="01_SCRIPT/chapters/block-party/CHAPTER_ONE_READTHROUGH.md">Full screenplay</a> · <a href="05_VIDEO_JOBS/dialogue.csv">Dialogue CSV</a> · <a href="05_VIDEO_JOBS/shotlist.csv">Shotlist CSV</a></p><div class="notice">Alley Runner has no unique approved portrait. Landscape wallpapers are look references, not matching angles of the tall battlefield plates. Preserve character identity; create the missing poses/props as directed. Extract the ZIP before opening this gallery.</div><h2>Scene production jobs</h2><ol>'''+job_links+'</ol><h2>Full-resolution source art</h2><div class="grid">'+''.join(cards)+'</div></main></html>')

inventory=[]
for p in sorted(OUT.rglob('*')):
    if p.is_file():inventory.append({'path':p.relative_to(OUT).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
write('FILE_INTEGRITY.json',json.dumps(inventory,indent=2))
zip_path=OUT.with_suffix('.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(OUT.rglob('*')):
        if p.is_file():z.write(p,OUT.name+'/'+p.relative_to(OUT).as_posix())
with zipfile.ZipFile(zip_path) as z:
    assert z.testzip() is None
    for r in inventory:
        assert hashlib.sha256(z.read(OUT.name+'/'+r['path'])).hexdigest()==r['sha256']
print(json.dumps({'zip':str(zip_path),'bytes':zip_path.stat().st_size,'files':len(inventory)+1,'scenes':len(scenes),'normal_clips':len(clips),'shots':len(shots),'dialogue_lines':len(all_lines)},indent=2))
