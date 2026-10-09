import json,html,hashlib
from pathlib import Path
p=Path('artifacts/deliverables/faction-buffs-v51');plan=json.loads((p/'plan.json').read_text());rows=[]
for i in range(8):
 x=json.loads((p/f'worker-{i}.json').read_text());assert x['index']==i and x['count']==8 and x['sourceHash']==plan['sourceHash'];assert [r['caseIndex'] for r in x['rows']]==[c['originalIndex'] for n,c in enumerate(plan['cases']) if n%8==i];rows+=x['rows']
assert len(rows)==4080 and len({r['caseIndex'] for r in rows})==4080
scenarios={x['originalIndex']:x['scenario'] for x in plan['cases']}
for row in rows:
 r=row['result'];c=scenarios[row['caseIndex']]
 assert (r['deckAId'],r['deckBId'],r['districtSeed'],r['rotation'],r['tier'],r['seat'])==(c['a'],c['b'],c['seed'],c['rotation'],c['tier'],c['seat'])
 player=c['a'] if c['seat']=='a-player' else c['b'];assert r['playerDeckId']==player
 assert r['logicalWinner']==('draw' if r['winner']=='draw' else 'a' if (player if r['winner']=='player' else r['cpuDeckId'])==c['a'] else 'b')
names={d['id']:d['name'] for d in plan['decks']}
def metric(rs,id,opp=None):
 xs=[r['result'] for r in rs if id in (r['result']['deckAId'],r['result']['deckBId']) and (not opp or opp in (r['result']['deckAId'],r['result']['deckBId']))]
 wins=sum(x['logicalWinner']==('a' if x['deckAId']==id else 'b') for x in xs);draws=sum(x['logicalWinner']=='draw' for x in xs)
 return {'games':len(xs),'wins':wins,'draws':draws,'losses':len(xs)-wins-draws,'score':(wins+draws*.5)/len(xs)}
summary=[{'id':id,'name':names[id],'before':metric(plan['baselineRows'],id),'after':metric(rows,id),'matchups':[{'opponent':opp,'name':names[opp],'before':metric(plan['baselineRows'],id,opp),'after':metric(rows,id,opp)} for opp in names if opp!=id]} for id in plan['ids']]
(p/'summary.json').write_text(json.dumps({'matches':4080,'sourceHash':plan['sourceHash'],'baselineHash':plan['baselineHash'],'decks':summary},indent=2)+'\n')
pct=lambda v:f'{v*100:.1f}%'
md='# Blue, Inmates, Homeless and Wonderland buffs\n\nLocal candidate, pending rules 51. 4,080 fresh matched comparisons against all 46 league builds, 720 games per requested build, 16 per opponent. Baseline uses the exact source-pinned prior sweep inputs; no baseline simulation was repeated. Both seats, two district seeds, base/full training, greedy/seeded-legal policies, SQUABBLE enabled. Six requested builds include three Inmate variants. Results count draws as half; these are bot scores, not human win rates.\n\n| Deck | Before | After |\n|---|---:|---:|\n'
h='<!doctype html><meta charset="utf-8"><style>body{background:#10151b;color:#eee;margin:38px;font:18px Arial}h1,h2,th{color:#ffc65b}p{line-height:1.5;color:#bbc6d2}table{width:100%;border-collapse:collapse}td,th{padding:16px;text-align:left;border-bottom:1px solid #34404b}.score{color:#84e4ba;font-weight:bold;font-size:24px}</style><h1>Blue · Inmates · Homeless · Wonderland</h1><p>4,080 fresh matched comparisons · 46 opponents/builds · 720 games per requested deck<br>Actual Red includes GUAP and Folks · GUAP unchanged · Local, unpublished</p><table><tr><th>Deck</th><th>Before</th><th>After</th></tr>'
for r in summary:
 md+=f"| {r['name']} | {pct(r['before']['score'])} | {pct(r['after']['score'])} |\n"
 h+=f"<tr><td>{html.escape(r['name'])}</td><td>{pct(r['before']['score'])}</td><td class=score>{pct(r['after']['score'])}</td></tr>"
h+='</table><h2>Direct Red matchup — 16 games each</h2><table><tr><th>Deck</th><th>Before</th><th>After</th></tr>'
md+='\n## Red matchups\n\n| Deck | Before | After |\n|---|---:|---:|\n'
for r in summary:
 m=next(x for x in r['matchups'] if x['opponent']=='focused-red-set');md+=f"| {r['name']} | {pct(m['before']['score'])} | {pct(m['after']['score'])} |\n";h+=f"<tr><td>{html.escape(r['name'])}</td><td>{pct(m['before']['score'])}</td><td>{pct(m['after']['score'])}</td></tr>"
notes='Blue gains sturdier crew bodies. Inmates gain stronger bodies and cheaper support; Contraband remains two Motion to avoid free refund loops. Homeless gains earlier bodies and recovery threats; healing still restores actual damage only. Wonderland gains cheaper return pieces and stronger threats; execution threshold and Grin caps are unchanged. No ability text, card identity, artwork, deck recipe, or GUAP kit changed.\n\nHomeless remains weak directly against Red despite broad improvement. Wonderland is now strong overall but its Red matchup remains unfavorable. Inmates reach the strong end of the field; another automatic buff is not justified by these scores. Pairwise samples are exploratory and use only two district seeds and one draw rotation.\n\nAll rows were checked for complete worker assignment, exact source hash, unchanged input axes, and seat-normalized winners. This is a targeted comparison, not a fresh ranking of all 46 decks after the buffs.\n'
md+='\n'+notes;h+='</table><p>Bot score counts draws as half. Homeless and Wonderland still struggle against Red.<br>Ability caps, recovery limits, immunity rules and GUAP remain unchanged.</p>'
(p/'REPORT.md').write_text(md);(p/'report.html').write_text(h)
print(json.dumps(summary and [(r['name'],pct(r['before']['score']),pct(r['after']['score'])) for r in summary],indent=2))
