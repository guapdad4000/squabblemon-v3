#!/usr/bin/env python3
"""Render a verified, source-pinned fullBalanceSweep bundle using only its evidence.

Usage: python3 scripts/src/current-deck-report.py --matrix PATH --stress PATH
       --confirmation PATH [--supplemental PATH] --out PATH
Historical evidence is never updated; derived outputs are write-once.
"""
import argparse
import csv
import hashlib
import io
import json
import math
import os
from pathlib import Path
import tempfile
from datetime import datetime, timezone


class EvidenceError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise EvidenceError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_json(path):
    raw = path.read_bytes()
    require(not raw.startswith(b'version https://git-lfs'), f'{path}: restore archived LFS payload before analysis')
    return json.loads(raw), digest(raw)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=True, allow_nan=False)


def empty_score():
    return dict(games=0, wins=0, draws=0, points=0, playerGames=0, playerPoints=0, cpuGames=0, cpuPoints=0)


def fold(table, key, points, player):
    score = table.setdefault(key, empty_score())
    score['games'] += 1
    score['wins'] += int(points == 1)
    score['draws'] += int(points == 0.5)
    score['points'] += points
    seat = 'player' if player else 'cpu'
    score[f'{seat}Games'] += 1
    score[f'{seat}Points'] += points


def compare_numbers(actual, expected, label):
    for key, value in expected.items():
        received = actual.get(key)
        require(isinstance(received, (int, float)) and not isinstance(received, bool)
                and math.isfinite(received) and math.isclose(received, value, rel_tol=1e-10, abs_tol=1e-10),
                f'{label}: {key} mismatch ({received!r} != {value!r})')


def validate_stage(directory):
    directory = Path(directory).resolve()
    plan, plan_file_hash = read_json(directory / 'plan.json')
    summary, summary_hash = read_json(directory / 'summary.json')
    require(plan.get('schemaVersion') == 2 and summary.get('schemaVersion') == 2,
            f'{directory}: current reports require schema 2 provenance')
    unsigned = {key: value for key, value in plan.items() if key != 'planHash'}
    require(digest(canonical(unsigned).encode()) == plan.get('planHash'), f'{directory}: plan checksum mismatch')
    require(summary.get('status') == 'complete', f'{directory}: report is not complete')
    for key in ['sourceHash', 'planHash', 'rulesVersion', 'balanceVersion', 'policyVersion', 'commit', 'runtime', 'stage']:
        require(key in plan and summary.get(key) == plan[key], f'{directory}: incompatible {key}')
    require(plan.get('manifest', {}).get('sha256') == plan['sourceHash'], f'{directory}: source manifest mismatch')
    require(isinstance(plan['sourceHash'], str) and len(plan['sourceHash']) == 64, 'Missing SHA-256 source identity')
    require(summary.get('failures') == [], f'{directory}: failed cases cannot be ranked')
    checks = ['allCaseIndexes', 'uniqueCases', 'rawHashes', 'seatNormalization', 'sourceFreeze']
    require(all(summary.get('checks', {}).get(key) is True for key in checks), f'{directory}: verification check missing')
    cases = plan['cases']
    require(cases and len({c['key'] for c in cases}) == len(cases), f'{directory}: empty or duplicate schedule')
    require(all(summary.get(key) == len(cases) for key in ['scheduled', 'completed', 'successful']),
            f'{directory}: incomplete schedule')
    decks = {deck['id']: deck for deck in plan['decks']}
    require(len(decks) == len(plan['decks']), f'{directory}: duplicate deck IDs')
    catalog = {card['id']: card for card in plan['coverage']['catalog']}
    require(len(catalog) == len(plan['coverage']['catalog']), f'{directory}: duplicate catalog IDs')
    for deck in decks.values():
        require(len(deck['cardIds']) == 10 and len(set(deck['cardIds'])) == 10, f'{deck["id"]}: invalid ten-card roster')
        require(set(deck['cardIds']) <= catalog.keys(), f'{deck["id"]}: unknown catalog cards')
    for case in cases:
        require(case['a'] in decks and case['b'] in decks, 'Schedule refers to missing deck')
        require(case['seat'] in ['a-player', 'b-player'], 'Invalid seat')
        require(case['tierA'] == 0 and case['tierB'] == 0, 'Current PvP report requires base training')
    columns = plan['telemetryColumns']
    require(columns[0] == 'cardId' and 'played' in columns, 'Missing card deployment telemetry')
    workers = summary['workers']
    count = len(workers)
    require(count > 0 and {w['index'] for w in workers} == set(range(count)), 'Missing or duplicate workers')
    require({p.name for p in directory.glob('worker-*.json')} == {f'worker-{i}.json' for i in range(count)},
            'Unlisted or missing worker summaries')
    seen, scores, matchups, card_rows, stage_counts = set(), {}, {}, {}, {}
    files = {'plan.json': plan_file_hash, 'summary.json': summary_hash}
    for index in range(count):
        worker, worker_hash = read_json(directory / f'worker-{index}.json')
        listed = next(w for w in workers if w['index'] == index)
        require(worker.get('index') == index and worker.get('count') == count, 'Worker partition mismatch')
        require(worker.get('sourceHash') == plan['sourceHash'] and worker.get('planHash') == plan['planHash'], 'Mixed-source/plan worker')
        require(worker.get('failures') == [], 'Worker has failed cases')
        raw_hash, rows = hashlib.sha256(), 0
        with (directory / f'worker-{index}.jsonl').open('rb') as stream:
            for line in stream:
                raw_hash.update(line)
                if not line.strip():
                    continue
                row = json.loads(line)
                case_index = row.get('caseIndex')
                require(type(case_index) is int and 0 <= case_index < len(cases)
                        and case_index % count == index and case_index not in seen, 'Duplicate, wrong-shard or unknown case index')
                require(not row.get('failure'), 'Raw match failure')
                seen.add(case_index)
                rows += 1
                case = cases[case_index]
                winner, logical = row.get('winner'), row.get('logicalWinner')
                require(winner in ['player', 'cpu', 'draw'] and logical in ['a', 'b', 'draw'], 'Invalid winner')
                a_owner = 'player' if case['seat'] == 'a-player' else 'cpu'
                require(logical == ('draw' if winner == 'draw' else 'a' if winner == a_owner else 'b'), 'Seat normalization mismatch')
                points = 1 if logical == 'a' else 0.5 if logical == 'draw' else 0
                stage_counts[case['stage']] = stage_counts.get(case['stage'], 0) + 1
                for deck_id, value, player in [(case['a'], points, a_owner == 'player'), (case['b'], 1-points, a_owner != 'player')]:
                    fold(scores, f'{case["stage"]}|{case["policy"]}|0|{deck_id}', value, player)
                    if case['stage'] == 'matrix':
                        fold(scores, f'matrix|all|all|{deck_id}', value, player)
                matchup_key = '|'.join(str(case[k]) for k in ['stage', 'policy', 'a', 'b', 'tierA', 'tierB'])
                matchup = matchups.setdefault(matchup_key, dict(games=0, points=0, playerPoints=0, draws=0))
                matchup['games'] += 1
                matchup['points'] += points
                matchup['playerPoints'] += 1 if winner == 'player' else 0.5 if winner == 'draw' else 0
                matchup['draws'] += int(logical == 'draw')
                for side in ['A', 'B']:
                    telemetry = row[f'cards{side}']
                    require(len(telemetry) == len(decks[case[side.lower()]]['cardIds']) and {c[0] for c in telemetry} == set(decks[case[side.lower()]]['cardIds']), 'Telemetry roster mismatch')
                    for card in telemetry:
                        require(len(card) == len(columns), 'Telemetry column mismatch')
                        require(all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in card[1:]), 'Non-finite card telemetry')
                        values = dict(zip(columns, card))
                        require(values['played'] >= 0, 'Negative deployment count')
                        record = card_rows.setdefault(f'{case["stage"]}|{card[0]}', dict(appearances=0, deployedMatches=0, **{key: 0 for key in columns[1:]}))
                        record['appearances'] += 1
                        record['deployedMatches'] += int(values['played'] > 0)
                        for key in columns[1:]:
                            record[key] += values[key]
        require(raw_hash.hexdigest() == worker['rawSha256'] == listed['rawSha256'], 'Raw worker checksum mismatch')
        require(rows == worker['completed'] == listed['completed'], 'Worker completion mismatch')
        files[f'worker-{index}.json'] = worker_hash
        files[f'worker-{index}.jsonl'] = raw_hash.hexdigest()
    require(len(seen) == len(cases), 'Missing scheduled cases')
    require(summary['stageCounts'] == stage_counts, 'Stage totals mismatch')
    require(len(summary['decks']) == len(scores) and {r['key'] for r in summary['decks']} == scores.keys(), 'Deck aggregate coverage mismatch')
    for row in summary['decks']:
        expected = scores[row['key']]
        compare_numbers(row, {**expected, 'scoreRate': expected['points']/expected['games']}, row['key'])
    require(len(summary['matchups']) == len(matchups) and {r['key'] for r in summary['matchups']} == matchups.keys(), 'Matchup coverage mismatch')
    for row in summary['matchups']:
        expected = matchups[row['key']]
        compare_numbers(row, {**expected, 'deckAScoreRate': expected['points']/expected['games']}, row['key'])
    require(len(summary['cards']) == len(card_rows) and {r['key'] for r in summary['cards']} == card_rows.keys(), 'Card coverage mismatch')
    for row in summary['cards']:
        compare_numbers(row, card_rows[row['key']], row['key'])
    ranks = {key: value for key, value in scores.items() if key.startswith('matrix|all|all|')}
    require(len(summary['rankings']) == len(ranks) and {r['key'] for r in summary['rankings']} == ranks.keys(), 'Ranked deck coverage mismatch')
    for row in summary['rankings']:
        compare_numbers(row, {**ranks[row['key']], 'scoreRate': ranks[row['key']]['points']/ranks[row['key']]['games']}, row['key'])
    return dict(directory=directory, plan=plan, summary=summary, files=files, scores=scores, matchups=matchups, card_rows=card_rows, catalog=catalog, decks=decks)


def csv_text(columns, rows):
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def md(value):
    return str(value).replace('|', '\\|').replace('\n', ' ')


def rate(value):
    return round(value * 100, 6)


def score_fields(score):
    return dict(games=score['games'], wins=score['wins'], losses=score['games']-score['wins']-score['draws'], draws=score['draws'],
                scorePercent=rate(score['points']/score['games']), winPercent=rate(score['wins']/score['games']),
                playerSeatGames=score['playerGames'], playerSeatScorePercent=rate(score['playerPoints']/score['playerGames']) if score['playerGames'] else '',
                cpuSeatGames=score['cpuGames'], cpuSeatScorePercent=rate(score['cpuPoints']/score['cpuGames']) if score['cpuGames'] else '')


def render_bundle(matrix, stress, confirmation, supplemental=None):
    stages = dict(matrix=validate_stage(matrix), stress=validate_stage(stress), confirmation=validate_stage(confirmation))
    if supplemental is not None:
        stages['supplemental'] = validate_stage(supplemental)
    baseline = stages['matrix']
    plan = baseline['plan']
    require({c['seat'] for c in plan['cases']} == {'a-player', 'b-player'}, 'League must include both seat assignments')
    require(all(c['stage'] == 'matrix' for c in plan['cases']), 'Matrix contains non-league cases')
    require(plan['stage'] in ['matrix', 'competitive-matrix', 'competitive-validation'], 'Wrong matrix plan stage')
    require(stages['stress']['plan']['stage'] == 'stress', 'Wrong stress plan stage')
    require(stages['confirmation']['plan']['stage'] == 'confirmation', 'Wrong confirmation plan stage')
    require(all(c['stage'] == 'independent-confirmation' for c in stages['confirmation']['plan']['cases']), 'Confirmation contains non-confirmation cases')
    if supplemental is not None:
        supplemental_plan = stages['supplemental']['plan']
        require(supplemental_plan['stage'] == 'coverage-completion', 'Wrong supplemental plan stage')
        require(all(c['stage'] == 'coverage-completion' for c in supplemental_plan['cases']), 'Supplemental contains non-coverage-completion cases')
        earlier_seeds = {c['seed'] for name, stage in stages.items() if name != 'supplemental' for c in stage['plan']['cases']}
        require(earlier_seeds.isdisjoint(c['seed'] for c in supplemental_plan['cases']), 'Supplemental reuses prior dataset seeds')
        if 'selection' in supplemental_plan:
            selection = supplemental_plan['selection']
            require(selection.get('matrixPlanHash') == plan['planHash'], 'Supplemental selection matrix plan mismatch')
            require(selection.get('stressPlanHash') == stages['stress']['plan']['planHash'], 'Supplemental selection stress plan mismatch')
            require(set(selection.get('unplayedCardIds', [])) <= baseline['catalog'].keys(), 'Supplemental selection refers to unknown cards')
    for name, stage in stages.items():
        for key in ['sourceHash', 'rulesVersion', 'balanceVersion', 'policyVersion', 'commit', 'runtime']:
            require(stage['plan'][key] == plan[key], f'{name}: incompatible {key}')
        require(stage['catalog'] == baseline['catalog'], f'{name}: different catalog snapshot')
        for deck_id, deck in baseline['decks'].items():
            require(stage['decks'].get(deck_id) == deck, f'{name}: changed ordered roster {deck_id}')
    confirmation_plan = stages['confirmation']['plan']
    require(set(c['seed'] for c in plan['cases']).isdisjoint(c['seed'] for c in confirmation_plan['cases']), 'Confirmation reuses matrix seeds')
    selection_path = stages['confirmation']['directory'] / 'selection.json'
    if selection_path.exists():
        selection, selection_hash = read_json(selection_path)
        require(selection['exploratorySourceHash'] == plan['sourceHash'], 'Confirmation selection source mismatch')
        require(all(deck_id in baseline['decks'] for deck_id in selection.get('rankingsUsed', [])), 'Confirmation selected unknown league deck')
        stages['confirmation']['files']['selection.json'] = selection_hash
    catalog, decks = baseline['catalog'], baseline['decks']
    expected_pairs = {tuple(sorted((a, b))) for a in decks for b in decks}
    actual_pairs = {tuple(sorted((case['a'], case['b']))) for case in plan['cases']}
    require(actual_pairs == expected_pairs, 'League is missing unordered pairs or mirrors')
    ranking_scores = [(key.split('|')[3], value) for key, value in baseline['scores'].items() if key.startswith('matrix|all|all|')]
    require({deck_id for deck_id, _ in ranking_scores} == decks.keys(), 'Every league deck must have a ranked sample')
    require(len({score['games'] for _, score in ranking_scores}) == 1, 'Unequal league sample sizes')
    ranking_scores.sort(key=lambda item: (-item[1]['points']/item[1]['games'], item[0]))
    rankings, rosters = [], []
    prior, rank = None, 0
    for position, (deck_id, score) in enumerate(ranking_scores, 1):
        value = score['points']/score['games']
        if value != prior:
            rank = position
        prior = value
        tier = 'S' if value >= .60 else 'A' if value >= .55 else 'B' if value >= .50 else 'C' if value >= .45 else 'D'
        row = dict(rank=rank, tier=tier, deckId=deck_id, deck=decks[deck_id]['name'], **score_fields(score))
        rankings.append(row)
        rosters.append({**row, **{f'card{index}Id': card_id for index, card_id in enumerate(decks[deck_id]['cardIds'], 1)}, **{f'card{index}Name': catalog[card_id]['name'] for index, card_id in enumerate(decks[deck_id]['cardIds'], 1)}})
    matchups = []
    for name, stage in stages.items():
        for key, value in sorted(stage['matchups'].items()):
            kind, policy, a, b, tier_a, tier_b = key.split('|')
            wins = int(value['points'] - value['draws']/2)
            matchups.append(dict(dataset=name, stage=kind, policy=policy, deckAId=a, deckA=stage['decks'][a]['name'], deckBId=b, deckB=stage['decks'][b]['name'], tierA=tier_a, tierB=tier_b, games=value['games'], winsA=wins, lossesA=value['games']-wins-value['draws'], draws=value['draws'], deckAScorePercent=rate(value['points']/value['games'])))
    represented = set(card for deck in decks.values() for card in deck['cardIds'])
    coverage_rows = []
    for card_id, card in sorted(catalog.items()):
        deployments = {name: sum(row['played'] for key, row in stage['card_rows'].items() if key.split('|')[1] == card_id) for name, stage in stages.items()}
        coverage_rows.append({**card, 'inLeagueRecipe': card_id in represented, 'playedByDataset': deployments, 'observedPlayed': sum(deployments.values()) > 0})
    coverage = dict(catalogCount=len(catalog), leagueDeckCount=len(decks), authoredRecipeReferences=plan['coverage']['candidates'], aliases=plan['coverage']['aliases'], leagueRepresentedCardCount=len(represented), outsideLeagueRecipeCount=len(catalog)-len(represented), observedPlayedCardCount=sum(c['observedPlayed'] for c in coverage_rows), unobservedCardIds=[c['id'] for c in coverage_rows if not c['observedPlayed']], cards=coverage_rows,
                    limitation='A deployment proves only that a card was played in this schedule; it does not prove every ability, matchup, custom crew, training tier or human strategy was exercised.')
    total = sum(len(stage['plan']['cases']) for stage in stages.values())
    additional = [f'{len(stages["stress"]["plan"]["cases"]):,} stress/probe matches', f'{len(confirmation_plan["cases"]):,} confirmation matches']
    if supplemental is not None:
        additional.append(f'{len(stages["supplemental"]["plan"]["cases"]):,} supplemental coverage-completion matches')
    axes = {key: sorted({case[key] for case in plan['cases']}) for key in ['policy', 'seed', 'rotation', 'tierA', 'tierB', 'seat']}
    lines = ['# Current tested deck tiers and named rosters', '', f'- Rules **{plan["rulesVersion"]}**, card balance **{plan["balanceVersion"]}**; base Git commit `{plan["commit"]}`; source SHA-256 `{plan["sourceHash"]}`.',
             '- The source manifest in each plan.json binds the audited working source, including local uncommitted changes. The base Git commit alone cannot reproduce this run.',
             f'- **{len(decks):,} fixed league recipes; {len(plan["cases"]):,} league matches; {rankings[0]["games"]:,} seat appearances per deck.** Mirror games contribute two deck appearances.',
             f'- Additional evidence: {"; ".join(additional)}. {total:,} successful scheduled matches overall; zero failed cases.',
             f'- League recipes represent {len(represented):,}/{len(catalog):,} collectible cards. Across all {len(stages)} schedules, {coverage["observedPlayedCardCount"]:,} cards were observed played; {len(coverage["unobservedCardIds"]):,} were not.',
             '- Score = (wins + half draws) / appearances. Tier bands: S ≥60%, A ≥55%, B ≥50%, C ≥45%, D <45%. These descriptive bands are not confidence intervals.',
             f'- Policy model: `{plan["policyVersion"]}`.',
             '- These are source-pinned automated **base-card PvP** samples, not live player win rates, an optimized/custom-deck search, PvE results or validation of upgraded cards. Confirmation, stress and supplemental coverage samples are not pooled into league ranks.',
             f'- Policies: {", ".join(axes["policy"])}. League: {len(axes["seed"])} distinct seed labels, rotations {", ".join(map(str, axes["rotation"]))}, both seat assignments. Seed labels need not produce independent district layouts.',
             '- Live solo CPU uses chooseCpuPlay/revealCpuTurn with encounter behavior weights and a different search. These online-seat policy samples do not measure Story/training CPU performance.',
             '- Current policy shares legal paid-investment and eligible SQUABBLE choices with the live CPU, values planted KYLE fuses and resources through the configured round limit, and removes the obsolete Gamer cheap-card setup heuristic. The audit chain-two policy still considers only the top four immediate candidates and one additional own play, masks the opposing hand, and does not solve rival responses or most held-card/conditional future payoffs. These samples do not establish live-bot parity.',
             '- Current ability-event evidence compares mechanical JSON values independently of object key order. Historical abilitySuccesses remains a mixed JSON-text heuristic that can count insertion-order churn; it is not a current ability-success rate.',
             '- No gameplay change or deployment is implied. Full input/output checksums and runtime resolution are in [provenance.json](provenance.json); deployment coverage is in [coverage.json](coverage.json).', '',
             '| Rank | Band | Deck | Score | Wins / losses / draws | All ten cards, in tested order |', '|---:|:---:|---|---:|---|---|']
    for row, roster in zip(rankings, rosters):
        lines.append(f'| {row["rank"]} | {row["tier"]} | {md(row["deck"])} | {row["scorePercent"]:.2f}% | {row["wins"]} / {row["losses"]} / {row["draws"]} | '+ '; '.join(md(roster[f'card{i}Name']) for i in range(1, 11))+' |')
    lines += ['', '## Reading the evidence', '', '- [Named rosters and stable IDs](deck-rosters.csv), [sortable rankings](rankings.csv), [all matchup rows](matchups.csv), [policy/seat splits](deck-breakdowns.csv), and [catalog snapshot](catalog.csv).',
              f'- {", ".join(f"`{stage['directory'].name}/`" for stage in stages.values())} retain separate plans, summaries, raw worker files and checksums. Keep their different policies and sample sizes visible.',
              '- Historical runs with different rules, rosters, policy models or schedules are not direct before/after comparisons. Card deployment and emitted events are descriptive, not causal card-strength estimates.', '']
    breakdowns = []
    for name, stage in stages.items():
        for key, value in sorted(stage['scores'].items()):
            kind, policy, tier, deck_id = key.split('|')
            breakdowns.append(dict(dataset=name, stage=kind, policy=policy, trainingTier=tier, deckId=deck_id, deck=stage['decks'][deck_id]['name'], **score_fields(value)))
    json_text = lambda value: json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False)+'\n'
    outputs = {'DECK-TIER-LIST.md': '\n'.join(lines), 'rankings.csv': csv_text(list(rankings[0]), rankings),
               'deck-rosters.csv': csv_text(list(rankings[0])+[column for i in range(1, 11) for column in [f'card{i}Id', f'card{i}Name']], rosters),
               'matchups.csv': csv_text(list(matchups[0]), matchups), 'deck-breakdowns.csv': csv_text(list(breakdowns[0]), breakdowns), 'coverage.json': json_text(coverage),
               'catalog.csv': csv_text(list(next(iter(catalog.values()))), sorted(catalog.values(), key=lambda c: c['id']))}
    provenance = dict(schemaVersion=1, status='complete', generatedAt=datetime.now(timezone.utc).isoformat(), sourceHash=plan['sourceHash'], commit=plan['commit'], commitMeaning='Base Git HEAD when planned. sourceHash and the source manifest in each plan.json bind the audited working source, including local uncommitted changes; the commit alone cannot reproduce this run.', rulesVersion=plan['rulesVersion'], balanceVersion=plan['balanceVersion'], runtime=plan['runtime'], policyVersion=plan['policyVersion'], rendererSha256=digest(Path(__file__).read_bytes()),
                      checks=[f'All {len(stages)} summaries complete with zero failures', 'Compatible engine/source/runtime/version/catalog snapshots', 'Identical ordered league rosters across datasets', 'Raw worker checksums and exact case partitions independently verified', 'Seat-normalized outcomes, deck/matchup/card aggregates independently recomputed', 'Full unordered league pairs including mirrors; equal league appearance counts; confirmation seeds disjoint from league'] + (['Supplemental coverage-completion cases only; seeds disjoint from every other dataset; excluded from league ranks'] if supplemental is not None else []),
                      datasets={name: dict(directory=stage['directory'].name, stage=stage['plan']['stage'], planHash=stage['plan']['planHash'], createdAt=stage['plan']['createdAt'], scheduled=len(stage['plan']['cases']), exercisedDeckCount=len({case[side] for case in stage['plan']['cases'] for side in ['a', 'b']}), definedDeckCount=len(stage['decks']), inputFiles=stage['files'], scope=stage['plan']['scope']) for name, stage in stages.items()},
                      coverage={key: value for key, value in coverage.items() if key not in ['cards', 'aliases']}, leagueAxes=axes, outputs={name: digest(value.encode()) for name, value in outputs.items()})
    outputs['provenance.json'] = json_text(provenance)
    return outputs


def write_bundle(outputs, destination):
    destination = Path(destination)
    require(all(not (destination / name).exists() for name in outputs), 'Derived report already exists; archive it before rendering a replacement')
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.report-', dir=destination) as staging:
        for name, text in outputs.items():
            (Path(staging) / name).write_text(text, encoding='utf-8', newline='')
        for name in outputs:
            # Hard-link publication is atomic and refuses a concurrent replacement.
            os.link(Path(staging) / name, destination / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ['matrix', 'stress', 'confirmation', 'out']:
        parser.add_argument(f'--{key}', required=True, type=Path)
    parser.add_argument('--supplemental', type=Path, help='Optional separate coverage-completion evidence; never contributes to league ranks')
    args = parser.parse_args()
    try:
        outputs = render_bundle(args.matrix, args.stress, args.confirmation, supplemental=args.supplemental)
        write_bundle(outputs, args.out)
    except (EvidenceError, KeyError, OSError, ValueError) as error:
        parser.exit(1, f'Report rejected: {error}\n')
    print(f'PASS: verified {4 if args.supplemental is not None else 3} datasets; wrote {len(outputs)} derived reports to {args.out}')


if __name__ == '__main__':
    main()
