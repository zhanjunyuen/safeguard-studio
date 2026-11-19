"""Lists g01 gold items chosen for new follow-up Q&A, with their build keys.

    python3 scripts/marking-data/scale/followup_prep.py select   → data/scale/gold/fu_pick.json
    python3 scripts/marking-data/scale/followup_prep.py show A B → compact view of picks A..B
Keys follow build.ts: per-context counters over data/items/*.jsonl in name order, robust items excluded.
"""
import json, os, glob, random, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(HERE, 'data')
CTX = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'contexts.jsonl'))}

def keys():
    """(file, line index) → key, mirroring build.ts numbering (file-scoped: ctx#<stem>.<n>)."""
    count, out = {}, {}
    for f in sorted(glob.glob(os.path.join(D, 'items', '*.jsonl'))):
        for i, l in enumerate(x for x in open(f) if x.strip()):
            it = json.loads(l)
            st = os.path.basename(f).split('-')[0]
            ck = (st, it['ctx'])
            n = count.get(ck, 0); count[ck] = n + 1
            out[(os.path.basename(f), i)] = f"{it['ctx']}#{st}.{n}"
    return out

if sys.argv[1] == 'select':
    K = keys()
    items = [json.loads(l) for l in open(os.path.join(D, 'items', 'g01-gold.jsonl'))]
    random.seed(360)
    by = {}
    for k, it in enumerate(items):
        by.setdefault(CTX[it['ctx']]['criterion'], []).append(k)
    pick = []
    for c, ks in by.items():
        pick += random.sample(ks, 90)
    pick.sort()
    json.dump([{'k': k, 'key': K[('g01-gold.jsonl', k)]} for k in pick], open(os.path.join(D, 'scale', 'gold', 'fu_pick.json'), 'w'))
    print(len(pick))
else:
    a, b = int(sys.argv[2]), int(sys.argv[3])
    items = [json.loads(l) for l in open(os.path.join(D, 'items', 'g01-gold.jsonl'))]
    picks = json.load(open(os.path.join(D, 'scale', 'gold', 'fu_pick.json')))[a:b]
    rows = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'rows', 'train.jsonl'))}
    for i, p in enumerate(picks, a):
        it = items[p['k']]; r = rows.get(p['key'])
        m = json.loads(r['completion'])
        got = ' | '.join(f"{c['id']}:\"{(c['evidence'] or '')[:60]}\"" for c in m['concepts'] if c['present'] and c['id'] != 'A1')
        miss = ','.join(c['id'] for c in m['concepts'] if not c['present'])
        a1 = next((('A1=' + ('Y' if c['present'] else 'N')) for c in m['concepts'] if c['id'] == 'A1'), '')
        print(f"[{i}] {p['key']} L{m['level']} {a1} miss:{miss or '-'} | {got or '-'} | FB: {m['feedback'][:110]}")
