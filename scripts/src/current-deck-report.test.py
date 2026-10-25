"""Small independent raw fixtures exercise acceptance and corruption rejection."""
import csv
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import sys
import unittest
from collections import Counter

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('current_deck_report', Path(__file__).with_name('current-deck-report.py'))
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)


def put(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


def fixture(root, matrix_plan_stage='competitive-validation', confirmation_plan_stage='confirmation', confirmation_case_stage='independent-confirmation', supplemental=False, supplemental_plan_stage='coverage-completion', supplemental_case_stage='coverage-completion', supplemental_seed='supplemental-seed'):
    catalog = [dict(id=f'c{i}', name=f'Fighter {i}, named', kind='character', type='Fire', cost=2, power=3, rarity='Common', catalogId=f'card-{i}', ability='Example', effect='Fixture text') for i in range(21)]
    catalog[0]['name'] = 'Écho | One'
    decks = [dict(id='a', name='Alpha', cardIds=[f'c{i}' for i in range(10)]), dict(id='b', name='Beta', cardIds=[f'c{i}' for i in range(10, 20)])]
    for name in ['matrix', 'stress', 'confirmation'] + (['supplemental'] if supplemental else []):
        directory = root/name
        directory.mkdir()
        stage_decks = decks + ([dict(id='probe', name='Probe', cardIds=['c20']+[f'c{i}' for i in range(9)])] if name in ['stress', 'supplemental'] else [])
        pairs = [('a', 'a'), ('a', 'b'), ('b', 'b')] if name == 'matrix' else [('probe', 'a')] if name in ['stress', 'supplemental'] else [('a', 'b')]
        stage = 'matrix' if name == 'matrix' else 'catalog-probe' if name == 'stress' else supplemental_case_stage if name == 'supplemental' else confirmation_case_stage
        cases = [dict(key=f'{name}:{a}:{b}:{seat}', stage=stage, a=a, b=b, policy='greedy', seed=supplemental_seed if name == 'supplemental' else name+'-seed', rotation=0, tierA=0, tierB=0, seat=seat) for a,b in pairs for seat in ['a-player', 'b-player']]
        plan = dict(schemaVersion=2, createdAt='2026-10-25T00:00:00Z', commit='test-commit', sourceHash='a'*64, manifest={'sha256':'a'*64}, rulesVersion=71, balanceVersion=72, policyVersion='fixture-v1', runtime={'node':'test-runtime'}, stage=matrix_plan_stage if name=='matrix' else confirmation_plan_stage if name=='confirmation' else supplemental_plan_stage if name=='supplemental' else name, cases=cases, decks=stage_decks, coverage=dict(catalog=catalog, candidates=2, aliases={'a':['a'], 'b':['b']}, represented=20, missing=[catalog[-1]]), telemetryColumns=['cardId','played'], scope=['Synthetic test fixture, not game evidence'])
        if name == 'supplemental':
            plan['selection'] = dict(matrixPlanHash=json.loads((root/'matrix/plan.json').read_text())['planHash'], stressPlanHash=json.loads((root/'stress/plan.json').read_text())['planHash'], unplayedCardIds=['c20'], reason='Finish fixture deployment coverage')
        plan['planHash'] = report.digest(report.canonical(plan).encode())
        raw_rows, score_counts, card_counts, matchup_counts = [], {}, {}, Counter()
        deck_map = {d['id']:d for d in stage_decks}
        for index, case in enumerate(cases):
            raw = dict(caseIndex=index, winner='draw', logicalWinner='draw', choices={}, investments={})
            for side in ['A','B']:
                ids = deck_map[case[side.lower()]]['cardIds']
                raw['cards'+side] = [[card, 0 if card=='c20' and name != 'supplemental' else 1] for card in ids]
                for card in ids:
                    card_counts[f'{stage}|{card}'] = card_counts.get(f'{stage}|{card}', 0)+1
                keys = [f'{stage}|greedy|0|{case[side.lower()]}'] + ([f'matrix|all|all|{case[side.lower()]}'] if stage=='matrix' else [])
                for key in keys:
                    score_counts.setdefault(key, Counter())['games'] += 1
                    player = (case['seat']=='a-player') == (side=='A')
                    score_counts[key]['playerGames' if player else 'cpuGames'] += 1
            matchup_counts['|'.join(str(case[k]) for k in ['stage','policy','a','b','tierA','tierB'])] += 1
            raw_rows.append(raw)
        raw_bytes = ''.join(json.dumps(row)+'\n' for row in raw_rows).encode()
        (directory/'worker-0.jsonl').write_bytes(raw_bytes)
        raw_hash = report.digest(raw_bytes)
        worker = dict(index=0,count=1,sourceHash=plan['sourceHash'],planHash=plan['planHash'],completed=len(cases),failures=[],proofs={},elapsedMs=1,rawSha256=raw_hash)
        scores = [dict(key=key,games=c['games'],wins=0,draws=c['games'],points=c['games']/2,playerGames=c['playerGames'],playerPoints=c['playerGames']/2,cpuGames=c['cpuGames'],cpuPoints=c['cpuGames']/2,scoreRate=.5) for key,c in score_counts.items()]
        summary = {key:plan[key] for key in ['schemaVersion','sourceHash','planHash','commit','rulesVersion','balanceVersion','policyVersion','runtime','stage']}
        summary.update(status='complete',scheduled=len(cases),completed=len(cases),successful=len(cases),failures=[],checks={key:True for key in ['allCaseIndexes','uniqueCases','rawHashes','seatNormalization','sourceFreeze']},workers=[{key:worker[key] for key in ['index','completed','elapsedMs','rawSha256']}],stageCounts={stage:len(cases)},decks=scores,rankings=[row for row in scores if '|all|all|' in row['key']],matchups=[dict(key=key,games=n,points=n/2,playerPoints=n/2,draws=n,deckAScoreRate=.5) for key,n in matchup_counts.items()],cards=[dict(key=key,appearances=n,deployedMatches=0 if key.endswith('|c20') and name != 'supplemental' else n,played=0 if key.endswith('|c20') and name != 'supplemental' else n) for key,n in card_counts.items()])
        put(directory/'plan.json',plan);put(directory/'summary.json',summary);put(directory/'worker-0.json',worker)


class CurrentDeckReportTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        fixture(self.root)
    def tearDown(self):
        self.temp.cleanup()
    def render(self):
        return report.render_bundle(*(self.root/name for name in ['matrix','stress','confirmation']))
    def test_current_policy_description_retains_actual_limits_without_obsolete_claims(self):
        text = self.render()['DECK-TIER-LIST.md']
        self.assertIn('shares legal paid-investment and eligible SQUABBLE choices', text)
        self.assertIn('resources through the configured round limit', text)
        self.assertIn('top four immediate candidates and one additional own play', text)
        self.assertIn('does not solve rival responses', text)
        self.assertIn('Historical abilitySuccesses remains a mixed JSON-text heuristic', text)
        self.assertIn('not a current ability-success rate', text)
        self.assertNotIn('live CPU retains a cheap-card Gamer setup heuristic', text)
        self.assertNotIn('stops valuing spare resources after round five', text)
    def change(self, dataset, name, transform):
        path = self.root/dataset/name
        value = json.loads(path.read_text());transform(value);put(path,value)
    def test_current_counts_names_and_separate_denominators(self):
        outputs = self.render()
        self.assertIn('Rules **71**, card balance **72**', outputs['DECK-TIER-LIST.md'])
        self.assertIn('base Git commit `test-commit`', outputs['DECK-TIER-LIST.md'])
        self.assertIn('local uncommitted changes', outputs['DECK-TIER-LIST.md'])
        provenance = json.loads(outputs['provenance.json'])
        self.assertEqual(provenance['commit'], 'test-commit')
        self.assertIn('commit alone cannot reproduce this run', provenance['commitMeaning'])
        self.assertIn('2 fixed league recipes; 6 league matches; 6 seat appearances', outputs['DECK-TIER-LIST.md'])
        rows = list(csv.DictReader(io.StringIO(outputs['deck-rosters.csv'])))
        self.assertEqual(rows[0]['card1Name'], 'Écho | One')
        self.assertEqual(rows[1]['card1Id'], 'c10')
        self.assertEqual([r['games'] for r in rows], ['6','6'])
        coverage = json.loads(outputs['coverage.json'])
        self.assertEqual((coverage['catalogCount'],coverage['leagueRepresentedCardCount'],coverage['observedPlayedCardCount']), (21,20,20))
        self.assertEqual(coverage['unobservedCardIds'],['c20'])
        self.assertEqual({r['dataset'] for r in csv.DictReader(io.StringIO(outputs['matchups.csv']))}, {'matrix','stress','confirmation'})
    def test_fresh_full_league_is_matrix_not_confirmation(self):
        outputs = self.render()
        provenance = json.loads(outputs['provenance.json'])
        self.assertEqual(provenance['datasets']['matrix']['stage'], 'competitive-validation')
        self.assertEqual(provenance['datasets']['confirmation']['stage'], 'confirmation')
        self.assertEqual(provenance['datasets']['matrix']['scheduled'], 6)
        self.assertEqual(provenance['datasets']['confirmation']['scheduled'], 2)
    def test_full_league_plan_cannot_be_used_as_confirmation(self):
        with tempfile.TemporaryDirectory() as fresh:
            root = Path(fresh)
            fixture(root, confirmation_plan_stage='competitive-validation', confirmation_case_stage='matrix')
            with self.assertRaisesRegex(report.EvidenceError, 'Wrong confirmation plan stage'):
                report.render_bundle(*(root/name for name in ['matrix','stress','confirmation']))
    def test_confirmation_label_cannot_hide_league_cases(self):
        with tempfile.TemporaryDirectory() as fresh:
            root = Path(fresh)
            fixture(root, confirmation_case_stage='matrix')
            with self.assertRaisesRegex(report.EvidenceError, 'non-confirmation cases'):
                report.render_bundle(*(root/name for name in ['matrix','stress','confirmation']))
    def test_supplemental_closes_coverage_without_changing_league_ranks(self):
        with tempfile.TemporaryDirectory() as fresh:
            root = Path(fresh)
            fixture(root, supplemental=True)
            inputs = [root/name for name in ['matrix','stress','confirmation']]
            before = report.render_bundle(*inputs)
            outputs = report.render_bundle(*inputs, supplemental=root/'supplemental')
            coverage = json.loads(outputs['coverage.json'])
            self.assertEqual(coverage['observedPlayedCardCount'], 21)
            self.assertEqual(coverage['unobservedCardIds'], [])
            card = next(c for c in coverage['cards'] if c['id'] == 'c20')
            self.assertEqual(card['playedByDataset'], dict(matrix=0, stress=0, confirmation=0, supplemental=2))
            self.assertEqual(outputs['rankings.csv'], before['rankings.csv'])
            self.assertEqual(outputs['deck-rosters.csv'], before['deck-rosters.csv'])
            self.assertIn('12 successful scheduled matches overall', outputs['DECK-TIER-LIST.md'])
            self.assertIn('Across all 4 schedules, 21 cards were observed played', outputs['DECK-TIER-LIST.md'])
            rows = list(csv.DictReader(io.StringIO(outputs['matchups.csv'])))
            self.assertEqual({r['stage'] for r in rows if r['dataset'] == 'supplemental'}, {'coverage-completion'})
            provenance = json.loads(outputs['provenance.json'])
            supplemental = provenance['datasets']['supplemental']
            self.assertEqual((supplemental['scheduled'], supplemental['definedDeckCount'], supplemental['exercisedDeckCount']), (2,3,2))
            self.assertIn('worker-0.jsonl', supplemental['inputFiles'])
    def test_supplemental_cannot_masquerade_as_another_role(self):
        for kwargs, message in [
            ({'supplemental_plan_stage':'confirmation'}, 'Wrong supplemental plan stage'),
            ({'supplemental_case_stage':'matrix'}, 'non-coverage-completion cases'),
        ]:
            with self.subTest(**kwargs), tempfile.TemporaryDirectory() as fresh:
                root = Path(fresh)
                fixture(root, supplemental=True, **kwargs)
                with self.assertRaisesRegex(report.EvidenceError, message):
                    report.render_bundle(*(root/name for name in ['matrix','stress','confirmation']), supplemental=root/'supplemental')
    def test_supplemental_seeds_must_be_disjoint_from_every_prior_dataset(self):
        for dataset in ['matrix', 'stress', 'confirmation']:
            with self.subTest(dataset=dataset), tempfile.TemporaryDirectory() as fresh:
                root = Path(fresh)
                fixture(root, supplemental=True, supplemental_seed=dataset+'-seed')
                with self.assertRaisesRegex(report.EvidenceError, 'reuses prior dataset seeds'):
                    report.render_bundle(*(root/name for name in ['matrix','stress','confirmation']), supplemental=root/'supplemental')
    def test_supplemental_roster_and_selection_identity_are_checked(self):
        for mutation, message in [
            (lambda plan: plan['decks'][0]['cardIds'].reverse(), 'changed ordered roster'),
            (lambda plan: plan['selection'].update(matrixPlanHash='0'*64), 'selection matrix plan mismatch'),
        ]:
            with self.subTest(message=message), tempfile.TemporaryDirectory() as fresh:
                root = Path(fresh)
                fixture(root, supplemental=True)
                directory = root/'supplemental'
                plan = json.loads((directory/'plan.json').read_text())
                mutation(plan)
                plan['planHash'] = report.digest(report.canonical({k:v for k,v in plan.items() if k!='planHash'}).encode())
                put(directory/'plan.json', plan)
                for name in ['summary.json', 'worker-0.json']:
                    value = json.loads((directory/name).read_text())
                    value['planHash'] = plan['planHash']
                    put(directory/name, value)
                with self.assertRaisesRegex(report.EvidenceError, message):
                    report.render_bundle(*(root/name for name in ['matrix','stress','confirmation']), supplemental=directory)
    def test_incomplete_stage_refused(self):
        self.change('stress','summary.json',lambda d:d.update(successful=1))
        with self.assertRaisesRegex(report.EvidenceError,'incomplete'):self.render()
    def test_changed_plan_refused(self):
        self.change('matrix','plan.json',lambda d:d['decks'][0].update(name='Changed after simulation'))
        with self.assertRaisesRegex(report.EvidenceError,'plan checksum'):self.render()
    def test_raw_bytes_refused_even_when_summary_says_complete(self):
        with (self.root/'matrix/worker-0.jsonl').open('ab') as stream:stream.write(b'\n')
        with self.assertRaisesRegex(report.EvidenceError,'checksum'):self.render()
    def test_duplicate_case_refused(self):
        path=self.root/'matrix/worker-0.jsonl';lines=path.read_text().splitlines();lines[-1]=lines[0];path.write_text('\n'.join(lines)+'\n')
        with self.assertRaisesRegex(report.EvidenceError,'Duplicate'):self.render()
    def test_seat_normalization_refused(self):
        path=self.root/'matrix/worker-0.jsonl';rows=[json.loads(line) for line in path.read_text().splitlines()];rows[0]['winner']='cpu';path.write_text(''.join(json.dumps(row)+'\n' for row in rows))
        with self.assertRaisesRegex(report.EvidenceError,'Seat normalization'):self.render()
    def test_forged_rank_summary_refused(self):
        self.change('matrix','summary.json',lambda d:d['rankings'][0].update(scoreRate=.9))
        with self.assertRaisesRegex(report.EvidenceError,'scoreRate mismatch'):self.render()
    def test_mixed_identity_refused(self):
        directory=self.root/'stress';plan=json.loads((directory/'plan.json').read_text());plan['sourceHash']='b'*64;plan['manifest']['sha256']='b'*64;plan['planHash']=report.digest(report.canonical({k:v for k,v in plan.items() if k!='planHash'}).encode());put(directory/'plan.json',plan)
        for name in ['summary.json','worker-0.json']:
            self.change('stress',name,lambda d:d.update(sourceHash=plan['sourceHash'],planHash=plan['planHash']))
        with self.assertRaisesRegex(report.EvidenceError,'incompatible sourceHash'):self.render()
    def test_write_once_preserves_existing_evidence(self):
        outputs=self.render();out=self.root/'published';report.write_bundle(outputs,out)
        before=(out/'provenance.json').read_bytes()
        with self.assertRaisesRegex(report.EvidenceError,'already exists'):report.write_bundle(outputs,out)
        self.assertEqual((out/'provenance.json').read_bytes(),before)


if __name__ == '__main__':
    unittest.main()
