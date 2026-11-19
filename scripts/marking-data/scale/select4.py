"""g04: more generated answers likely to reach Level 2, to narrow the author/level skew.
    python3 scripts/marking-data/scale/select4.py   → data/scale/gold/queue4.jsonl
Unused answers written to the 'complete answer' target (content 0); for anticipation only contexts where
the pupil's choice was right (otherwise Level 2 is impossible). One per context."""
import json, os, random, collections
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
C = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'contexts.jsonl'))}
used = {json.loads(l)['id'] for f in ('queue.jsonl', 'queue2.jsonl') for l in open(os.path.join(D, 'scale', 'gold', f))}
used_ctx = {json.loads(l)['ctx'] for f in ('queue.jsonl', 'queue2.jsonl') for l in open(os.path.join(D, 'scale', 'gold', f))}
A = [json.loads(l) for l in open(os.path.join(D, 'scale', 'answers.jsonl'))]
TARGET = {'anticipation': 45, 'revision': 45, 'testing': 30}
random.seed(4004); random.shuffle(A)
pick, seen = [], set()
for crit, n in TARGET.items():
    got = 0
    # prefer contexts not marked before, for variety
    for pref in (True, False):
        for a in A:
            c = C[a['ctx']]
            if got >= n: break
            if c['criterion'] != crit or a['content'] != 0 or a['id'] in used or a['ctx'] in seen: continue
            if (a['ctx'] not in used_ctx) != pref: continue
            if crit == 'anticipation' and not c['facts']['predictionCorrect']: continue
            pick.append(a); seen.add(a['ctx']); got += 1
pick.sort(key=lambda a: (C[a['ctx']]['criterion'], a['ctx']))
with open(os.path.join(D, 'scale', 'gold', 'queue4.jsonl'), 'w') as fh:
    for k, a in enumerate(pick): fh.write(json.dumps({'k': k, **a}, ensure_ascii=False) + '\n')
print(len(pick), dict(collections.Counter(C[a['ctx']]['criterion'] for a in pick)), dict(collections.Counter(a['author'] for a in pick)))
