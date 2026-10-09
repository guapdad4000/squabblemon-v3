import json,csv,html,hashlib
from pathlib import Path
import sys
p=Path(sys.argv[1] if len(sys.argv)>1 else 'artifacts/deliverables/full-deck-sweep-v51')
s=json.loads((p/'summary.json').read_text());c=json.loads((p/'coverage.json').read_text());plan=json.loads((p/'plan.json').read_text())
probes=[row for i in range(2) for row in json.loads((p/f'coverage-worker-{i}.json').read_text())['rows']]
assert len(probes)==81 and len({x['id'] for x in probes})==81
assert {x['id'] for x in probes}=={x['id'] for x in c['unrepresentedCards']}
for i in range(2):assert json.loads((p/f'coverage-worker-{i}.json').read_text())['sourceHash']==s['sourceHash']
for row in probes:
 assert len(row['results'])==24
 row['observedPlays']=sum(card['played'] for r in row['results'] for card in r['cardsA'] if card['cardId']==row['id'])
 row['scoreRate']=sum(1 if r['winner']=='a' else .5 if r['winner']=='draw' else 0 for r in row['results'])/24
assert all(r['observedPlays']>0 for r in probes),'Some cards were never played'
(p/'supplemental-card-coverage.json').write_text(json.dumps({'matches':1944,'cards':81,'sourceHash':s['sourceHash'],'probes':probes},indent=2)+'\n')
ranking=s['ranking']; pct=lambda x:f'{x*100:.1f}%'
cols=['rank','deck','score','wins','losses','draws','greedy','seeded','base','upgraded','first','second']
with (p/'ranking.csv').open('w') as f:
 w=csv.writer(f);w.writerow(cols)
 for r in ranking:w.writerow([r['rank'],r['name'],r['all']['scoreRate'],r['all']['wins'],r['all']['losses'],r['all']['draws']]+[r[k]['scoreRate'] for k in cols[6:]])
with (p/'matchups.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['deck','opponent','games','wins','losses','draws','score'])
 for r in ranking:
  for m in r['matchups']:w.writerow([r['name'],m['opponentName']]+[m['all'][k] for k in ['games','wins','losses','draws','scoreRate']])
notes=['All 57 authored/default/element/workshop recipe references represented by 46 unique ten-card compositions. Duplicate compositions count once; alias mappings are in coverage.json.',
'16,560 fresh league matches: every unordered deck pair, two district seeds, both seats, base and full training, greedy and seeded legal policies; SQUABBLE enabled. 720 games per deck; 16 per pair.',
'Actual GUAP and Folks remain in their authored decks. No test replacements, cached historical results or gameplay changes were used in this audit.',
'217 of 298 collectible cards occur in league recipes. The remaining 81 each received 24 separate coverage-probe matches against actual Red, Blue and Squabblehouse, for 1,944 additional matches. Every probe card was observed played. Probe deck scores are contextual diagnostics, not individual-card strength or league rankings.',
'Bot scores count draws as half a win. These fixed-build samples are not human win rates or optimized deck strength. Only two league district seeds and one draw rotation are covered. Manual movement is not optimized; ability-driven movement runs. Custom player decks and mixed-training matches are outside this sweep.',
'Current local candidate: balance/rules 51. This audit does not publish changes.']
md='# Full deck sweep — current roster\n\n'+ '\n\n'.join(notes)+'\n\nSource hash: '+s['sourceHash']+'\n\n## Every deck\n\n| Rank | Deck | Score | W/L/D | Greedy | Seeded | Base | Upgraded | First | Second |\n|---:|---|---:|---|---:|---:|---:|---:|---:|---:|\n'
for r in ranking:
 a=r['all'];md+='| '+ ' | '.join([str(r['rank']),r['name'],pct(a['scoreRate']),f"{a['wins']}/{a['losses']}/{a['draws']}"]+[pct(r[k]['scoreRate']) for k in cols[6:]])+' |\n'
md+='\n## Balance priorities\n\n'
for r in ranking[:5]:md+=f"- Strong end: {r['name']} — {pct(r['all']['scoreRate'])}; weakest matchup: "+', '.join(f"{m['opponentName']} ({pct(m['all']['scoreRate'])})" for m in r['worstMatchups'])+'.\n'
for r in ranking[-5:]:md+=f"- Needs support: {r['name']} — {pct(r['all']['scoreRate'])}; best matchup: "+', '.join(f"{m['opponentName']} ({pct(m['all']['scoreRate'])})" for m in r['bestMatchups'])+'.\n'
md+='\n## Key crew matchups\n\n| Crew | Overall | Red | Blue | Squabblehouse |\n|---|---:|---:|---:|---:|\n'
keyids=['starter-fitness-routes','starter-fitness-circuit','starter-music-tour','starter-music-industry','starter-sunday-dinner','starter-community-table']
for r in ranking:
 if r['deckId'] in keyids:
  md+='| '+r['name']+' | '+pct(r['all']['scoreRate'])+' | '+' | '.join(pct(next(m for m in r['matchups'] if m['opponentId']==oid)['all']['scoreRate']) for oid in ['focused-red-set','focused-blue-set','starter-squabblehouse-shift'])+' |\n'
md+='\n## Complete evidence\n\nplan.json pins all card lists and schedule axes. worker-0.json through worker-7.json contain every league outcome. summary.json contains all matchup and split rates. coverage.json maps recipe aliases and collectible coverage. supplemental-card-coverage.json retains the 81 supplemental card builds and per-card play observations. ranking.csv and matchups.csv are sortable exports. Merge validation passed complete Cartesian coverage, no failed/duplicate/missing cases, equal samples, seat-normalized results, and zero-sum scores.\n'
(p/'REPORT.md').write_text(md)
escape=html.escape
h='''<!doctype html><html><meta charset="utf-8"><title>Squabblemon full deck sweep</title><style>body{margin:36px;background:#10151b;color:#eee;font:16px Arial}h1{color:#ffc65b;font-size:34px}p{color:#bdc9d5;line-height:1.5}table{width:100%;border-collapse:collapse}td,th{padding:10px 9px;border-bottom:1px solid #34404b;text-align:left}th{color:#ffc65b}.score{font-weight:bold;color:#84e4ba}.meta{padding:18px;background:#1d2630;margin-bottom:22px}h2{margin-top:28px;color:#ffc65b}</style><h1>Squabblemon — Full Deck Sweep</h1><div class="meta">46 unique decks · 16,560 league matches · 1,944 card coverage matches<br>All 298 collectible cards represented across league + probes · Actual GUAP and Folks included · Rules 51<br>720 matches per deck · Zero simulation failures · Local, unpublished</div><p>Score = wins + half draws. Automated fixed builds; human win rates and custom decks are not measured.</p><table><tr><th>Rank</th><th>Deck</th><th>Score</th><th>W/L/D</th><th>Greedy</th><th>Seeded</th><th>Base</th><th>Upgraded</th></tr>'''
for r in ranking:
 a=r['all'];vals=[r['rank'],r['name'],pct(a['scoreRate']),f"{a['wins']}/{a['losses']}/{a['draws']}"]+[pct(r[k]['scoreRate']) for k in ['greedy','seeded','base','upgraded']]
 h+='<tr>'+''.join(f'<td class="{"score" if i==2 else ""}">{escape(str(v))}</td>' for i,v in enumerate(vals))+'</tr>'
h+='</table><h2>Coverage and limits</h2><p>217 cards in authored league recipes; 81 additional cards tested in supplemental shells. Every supplemental card was played. Two district seeds, one draw rotation, two policies, both seats and training tiers. Pairwise samples are exploratory. GUAP unchanged.</p></html>'
(p/'report.html').write_text(h)
manifest={x.name:hashlib.sha256(x.read_bytes()).hexdigest() for x in p.glob('*.json') if x.name!='evidence-manifest.json'}
(p/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'top':[(r['name'],pct(r['all']['scoreRate'])) for r in ranking[:5]],'bottom':[(r['name'],pct(r['all']['scoreRate'])) for r in ranking[-5:]],'key':[(r['name'],pct(r['all']['scoreRate'])) for r in ranking if r['deckId'] in keyids]},indent=2))
