"""Evaluation set from answers generated for held-out challenges and scenarios (gen-prep GEN_HOLDOUT=1).

    python3 scripts/marking-data/scale/test_select.py   → data/scale/answers-test.jsonl, data/scale/gold/queue3.jsonl
Picks a set spread across criteria, content targets (which aim at different levels) and generator models,
at most two answers per context (seven for the 5 held-out judgement scenarios). Claude marks them as g03 (GOLD_SET=3); every row lands in `test`.
"""
import json, os, random, re, collections
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
gen = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'scale', 'gen-test', 'input.jsonl'))}
ctx = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'contexts.jsonl'))}

def strings(t):
    """The JSON array of answers, or every complete quoted string if the array is cut off."""
    try:
        a = json.loads(re.sub(r'^[\s\S]*?(\[[\s\S]*\])[\s\S]*$', r'\1', t), strict=False)
        if isinstance(a, list): return [str(x) for x in a]
    except Exception: pass
    return [json.loads(m, strict=False) for m in re.findall(r'"(?:[^"\\]|\\.)*"', t)]

answers = []
for l in open(os.path.join(D, 'scale', 'gen-test', 'output.jsonl')):
    o = json.loads(l); g = gen.get(o['id'])
    if not g or o.get('error'): continue
    arr = strings(str(o.get('output_text') or ''))
    if not arr or len(arr) > len(g['specs']): continue
    for i, t in enumerate(arr):
        text = t.strip().strip('"“”')
        if len(text.split()) >= 4 and not re.search(r'content:|style:|instructions', text, re.I):
            answers.append({'id': f"{g['ctx']}|t{g['specs'][i]['i']}", 'ctx': g['ctx'], 'text': text, 'author': g['model'],
                             'content': g['specs'][i]['content'], 'call': g['id']})
with open(os.path.join(D, 'scale', 'answers-test.jsonl'), 'w') as fh:
    fh.write(''.join(json.dumps(a, ensure_ascii=False) + '\n' for a in answers))

TARGET = {'testing': 55, 'anticipation': 55, 'revision': 55, 'judgement': 35}
random.seed(3003)
random.shuffle(answers)
pick, per_ctx, per_cell = [], collections.Counter(), collections.Counter()
for crit, n in TARGET.items():
    pool = [a for a in answers if ctx[a['ctx']]['criterion'] == crit]
    cap = -(-n // 8)  # spread over the 8 content targets
    for a in pool:
        if sum(1 for p in pick if ctx[p['ctx']]['criterion'] == crit) >= n: break
        if per_ctx[a['ctx']] >= (7 if crit == 'judgement' else 2) or per_cell[(crit, a['content'])] >= cap: continue
        pick.append(a); per_ctx[a['ctx']] += 1; per_cell[(crit, a['content'])] += 1
pick.sort(key=lambda a: (ctx[a['ctx']]['criterion'], a['ctx']))
with open(os.path.join(D, 'scale', 'gold', 'queue3.jsonl'), 'w') as fh:
    for k, a in enumerate(pick):
        fh.write(json.dumps({'k': k, **a}, ensure_ascii=False) + '\n')
print(len(answers), 'answers;', len(pick), 'picked', dict(collections.Counter(ctx[a['ctx']]['criterion'] for a in pick)),
      dict(collections.Counter(a['author'] for a in pick)))
