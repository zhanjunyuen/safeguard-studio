"""Pupil profiles for skills-summary rows: one marked training answer per skill.

    python3 scripts/marking-data/scale/summary_prep.py select     → data/scale/gold/sum_pick.json
    python3 scripts/marking-data/scale/summary_prep.py show A B   → compact view of profiles A..B
Totals are spread from 0 to 8 by choosing a target level for each skill.
"""
import json, os, random, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(HERE, 'data')
ORDER = ['testing', 'anticipation', 'judgement', 'revision']
rows = [json.loads(l) for l in open(os.path.join(D, 'rows', 'train.jsonl'))]
pool = {c: {0: [], 1: [], 2: []} for c in ORDER}
for r in rows:
    if r['kind'] == 'marking' and r['level'] is not None and r['criterion'] in pool:
        pool[r['criterion']][r['level']].append(r['id'])

if sys.argv[1] == 'select':
    random.seed(8)
    out = []
    for i in range(200):
        total_target = i % 9  # 0..8 spread evenly
        levels = [0, 0, 0, 0]
        for _ in range(total_target):
            j = random.choice([k for k in range(4) if levels[k] < 2])
            levels[j] += 1
        out.append({c: random.choice(pool[c][levels[n]]) for n, c in enumerate(ORDER)})
    json.dump(out, open(os.path.join(D, 'scale', 'gold', 'sum_pick.json'), 'w'))
    print(len(out))
else:
    a, b = int(sys.argv[2]), int(sys.argv[3])
    byid = {r['id']: r for r in rows}
    picks = json.load(open(os.path.join(D, 'scale', 'gold', 'sum_pick.json')))[a:b]
    for i, p in enumerate(picks, a):
        parts, tot = [], 0
        for c in ORDER:
            m = json.loads(byid[p[c]]['completion']); tot += m['level']
            got = ','.join(x['id'] for x in m['concepts'] if x['present'] and x['id'] not in ('C4',))
            ev = next((x['evidence'] for x in m['concepts'] if x['present'] and x.get('evidence') and x['id'] != 'C4'), '')
            parts.append(f"{c[:4]} L{m['level']} [{got}] \"{(ev or '')[:45]}\"")
        print(f"[{i}] total {tot} | " + ' | '.join(parts))
