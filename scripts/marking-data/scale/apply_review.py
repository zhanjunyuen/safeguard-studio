"""Applies Claude's re-review of blind-judge disagreements to the gold marks and logs every decision.

    python3 scripts/marking-data/scale/apply_review.py <review file>   (GOLD_SET=2 for g02)
Each line of the review file: {"k", "decision": "correct"|"keep", "add": {id: quote}, "remove": [ids], "note"}.
Marks are edited in place in data/scale/gold/marks*/; data/scale/gold/review*.jsonl keeps the log.
"""
import json, glob, os, re, sys
SET = os.environ.get('GOLD_SET', '1'); SUF = '' if SET == '1' else SET
G = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'scale', 'gold')
norm = lambda s: re.sub(r'\s+', ' ', s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')).strip().lower()
q = {json.loads(l)['k']: json.loads(l) for l in open(os.path.join(G, f'queue{SUF}.jsonl'))}
rev = {o['k']: o for o in (json.loads(l) for l in open(sys.argv[1]) if l.strip())}
done = set()
for f in sorted(glob.glob(os.path.join(G, 'marks' + SUF, '*.jsonl'))):
    out = []
    for l in open(f):
        if not l.strip(): continue
        m = json.loads(l); r = rev.get(m['k'])
        if r and r['decision'] == 'correct' and m['k'] not in done:
            for cid, quote in r.get('add', {}).items():
                assert norm(quote) in norm(q[m['k']]['text']), (m['k'], quote)
                m['c'][cid] = quote
            for cid in r.get('remove', []):
                m['c'].pop(cid, None)
            done.add(m['k'])
        out.append(json.dumps(m, ensure_ascii=False))
    open(f, 'w').write('\n'.join(out) + '\n')
with open(os.path.join(G, f'review{SUF}.jsonl'), 'a') as fh:
    for r in rev.values():
        fh.write(json.dumps(r, ensure_ascii=False) + '\n')
print('corrected', len(done), 'logged', len(rev))
