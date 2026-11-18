"""After a gold review changes a level, swaps that item out of any skills summary whose total no
longer matches its text, for a train item of the same criterion with the concepts it had before review,
so the written summary stays true. Run after build.ts has written data/rows/train.jsonl.
    python3 scripts/marking-data/scale/fix_summaries.py"""
import json, os, random, re
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
rows = {r['id']: r for r in (json.loads(l) for l in open(os.path.join(D, 'rows', 'train.jsonl'))) if r['kind'] == 'marking'}
def pres(r):
    m = json.loads(r['completion']); return frozenset(c['id'] for c in m['concepts'] if c['present'] and c['id'] != 'C4')
# gold key → review corrections, for both gold sets
rev = {}
for SET in ('1', '2'):
    SUF = '' if SET == '1' else SET
    p = os.path.join(D, 'scale', 'gold', f'review{SUF}.jsonl')
    if not os.path.exists(p): continue
    items = [json.loads(l) for l in open(os.path.join(D, 'items', f'g0{SET}-gold.jsonl'))]
    cnt, key = {}, {}
    for k, it in enumerate(items):
        n = cnt.get(it['ctx'], 0); cnt[it['ctx']] = n + 1; key[k] = f"{it['ctx']}#g0{SET}.{n}"
    for l in open(p):
        o = json.loads(l)
        if o['decision'] == 'correct': rev.setdefault(key[o['k']], []).append(o)
def before(kk):
    p = set(pres(rows[kk]))
    for o in reversed(rev[kk]):
        for c in o.get('add', {}): p.discard(c)
        for c in o.get('remove', []): p.add(c)
    return frozenset(p - {'C4'})
pool = {}
for kk, r in rows.items(): pool.setdefault((r['criterion'], pres(r)), []).append(kk)
path = os.path.join(D, 'summaries', 's01.jsonl')
S = [json.loads(l) for l in open(path)]
random.seed(len(rev)); fixed = 0
for i, s in enumerate(S):
    tot = sum(json.loads(rows[k]['completion'])['level'] or 0 for k in s['items'].values())
    if tot == int(re.search(r'(\d) out of 8', s['summary']).group(1)): continue
    for c, kk in s['items'].items():
        if kk in rev:
            cands = [x for x in pool.get((c, before(kk)), []) if x not in rev]
            s['items'][c] = random.choice(cands); fixed += 1
            print(i, c, kk, '->', s['items'][c])
open(path, 'w').write('\n'.join(json.dumps(s, ensure_ascii=False) for s in S) + '\n')
print('swapped', fixed)
