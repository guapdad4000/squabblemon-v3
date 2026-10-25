"""Verify exact fresh schedules and compare every outcome and telemetry field."""
import json
import hashlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
BASELINE = ROOT / 'current-deck-audit-20261025-v64'
CANDIDATE = ROOT / 'current-deck-audit-20261025-runtime-v64'
CLASSIFICATION = {8, 9, 10, 11, 12}
COLUMNS = ['cardId', 'played', 'finalCopies', 'finalPower', 'activatedPlays', 'normalPlays', 'unknownPlays', 'baseEvents', 'baseDirectEffectEvents', 'baseNoObservedEffectEvents', 'baseNestedEffectEvents', 'baseNestedNoObservedEffectEvents', 'baseUnknownEvents', 'upgradeEvents', 'upgradeAppliedEvents']

def load(directory):
    plan = json.loads((directory / 'plan.json').read_text())
    rows, receipts = {}, []
    for raw in sorted(directory.glob('worker-*.jsonl')):
        receipt = json.loads(raw.with_suffix('.json').read_text())
        assert receipt['sourceHash'] == plan['sourceHash']
        assert receipt['planHash'] == plan['planHash']
        assert receipt['rawSha256'] == hashlib.sha256(raw.read_bytes()).hexdigest()
        assert not receipt['failures']
        receipts.append({'file': raw.name, 'sha256': receipt['rawSha256']})
        for line in raw.read_text().splitlines():
            row = json.loads(line)
            assert row['caseIndex'] not in rows and 'failure' not in row
            rows[row['caseIndex']] = row
    assert set(rows) == set(range(len(plan['cases'])))
    return plan, rows, receipts

def compare(before, after, plan):
    gameplay, other_telemetry, classification = set(), set(), []
    differing_rows = []
    deltas = {COLUMNS[i]: 0 for i in sorted(CLASSIFICATION)}
    for index in sorted(before):
        a, b = before[index], after[index]
        if a != b:
            differing_rows.append(index)
        if {k: v for k, v in a.items() if k not in ['cardsA', 'cardsB']} != {k: v for k, v in b.items() if k not in ['cardsA', 'cardsB']}:
            gameplay.add(index)
        for side in ['cardsA', 'cardsB']:
            assert len(a[side]) == len(b[side])
            for old_card, new_card in zip(a[side], b[side]):
                assert old_card[0] == new_card[0] and len(old_card) == len(new_card) == len(COLUMNS)
                if old_card[:4] != new_card[:4]:
                    gameplay.add(index)
                changes = {COLUMNS[i]: {'before': x, 'after': y} for i, (x, y) in enumerate(zip(old_card, new_card)) if x != y}
                if any(i not in CLASSIFICATION and x != y for i, (x, y) in enumerate(zip(old_card, new_card))):
                    other_telemetry.add(index)
                if any(i in CLASSIFICATION and x != y for i, (x, y) in enumerate(zip(old_card, new_card))):
                    classification.append({'caseIndex': index, 'caseKey': plan['cases'][index]['key'], 'side': side, 'cardId': old_card[0], 'fields': changes})
                for i in CLASSIFICATION:
                    deltas[COLUMNS[i]] += new_card[i] - old_card[i]
    return dict(cases=len(after), identicalCompleteRows=len(after) - len(differing_rows), completeRowDifferences=len(differing_rows), gameplayMismatchedCases=sorted(gameplay), nonclassificationTelemetryMismatchedCases=sorted(other_telemetry), currentClassificationMismatchedCases=len({r['caseIndex'] for r in classification}), currentClassificationDelta=deltas, currentClassificationChanges=classification)

output = dict(schemaVersion=2, status='complete', scope='All exact fresh raw outcome/card/choice/current-classification values compared; no fields silently discarded. Separate worker elapsed/source/plan bookkeeping is excluded.', legacyRawCounterPolicy='Exported abilitySuccesses retains its historical JSON-text heuristic and is not a current ability-success rate. Scheduled packed arrays publish current source-attributed evidence instead.', datasets={}, totalCases=0, gameplayMismatchedCases=0, nonclassificationTelemetryMismatchedCases=0, currentClassificationMismatchedCases=0)
for stage in ['matrix', 'stress', 'confirmation']:
    old_plan, old, old_receipts = load(BASELINE / stage)
    plan, fresh, receipts = load(HERE / stage)
    first_plan, first, first_receipts = load(CANDIDATE / stage)
    assert old_plan['cases'] == plan['cases'] == first_plan['cases']
    assert old_plan['decks'] == plan['decks'] and old_plan['coverage'] == plan['coverage']
    result = compare(old, fresh, plan)
    result.update(priorSourceHash=old_plan['sourceHash'], sourceHash=plan['sourceHash'], priorWorkers=old_receipts, freshWorkers=receipts, comparedWithRuntimeCandidate=compare(first, fresh, plan))
    output['datasets'][stage] = result
    output['totalCases'] += len(fresh)
    output['gameplayMismatchedCases'] += len(result['gameplayMismatchedCases'])
    output['nonclassificationTelemetryMismatchedCases'] += len(result['nonclassificationTelemetryMismatchedCases'])
    output['currentClassificationMismatchedCases'] += result['currentClassificationMismatchedCases']
assert output['totalCases'] == 20368
if output['gameplayMismatchedCases'] or output['nonclassificationTelemetryMismatchedCases']:
    output['status'] = 'unexpected-semantic-differences'
elif output['currentClassificationMismatchedCases']:
    output['status'] = 'complete-with-current-classification-corrections'
with (HERE / 'runtime-equivalence-results.json').open('x') as handle:
    json.dump(output, handle, indent=2)
    handle.write('\n')
print(json.dumps({k: v for k, v in output.items() if k != 'datasets'}, indent=2))
