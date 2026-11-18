"""Prints the blind-judge disagreements not yet in review*.jsonl, with simulator facts and both marks.
    python3 scripts/marking-data/scale/review_sheet.py   (GOLD_SET=2 for g02)"""
import json, os
SET = os.environ.get('GOLD_SET', '1'); SUF = '' if SET == '1' else SET
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
ctx = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'contexts.jsonl'))}
items = [json.loads(l) for l in open(os.path.join(D, 'items', f'g0{SET}-gold.jsonl'))]
rp = os.path.join(D, 'scale', 'gold', f'review{SUF}.jsonl')
seen = {json.loads(l)['k'] for l in open(rp)} if os.path.exists(rp) else set()
n = 0
for l in open(os.path.join(D, 'scale', f'judge-gold{SUF}', 'disagreements.jsonl')):
    if not l.strip(): continue
    d = json.loads(l)
    if d['k'] in seen: continue
    n += 1
    c = ctx[d['ctx']]; f = c['facts']; cr = d['criterion']
    if cr == 'testing': extra = f"broke={f.get('broke')} blocks={f.get('blocks')}"
    elif cr == 'anticipation': extra = f"predOK={f.get('predictionCorrect')} risk={c['packet'].get('curveball', c['packet']).get('risk', '')}"
    elif cr == 'revision': extra = f"before={f['before']} after={f['after']} failing={[x['title'] for x in f['failing']]} cr={f['creditsBefore']}->{f['creditsAfter']}"
    else: extra = json.dumps(f.get('anchors', {}).get('labels', ''))[:220]
    mine = {k: v for k, v in items[d['k']]['c'].items() if v}
    print(f"[{d['k']}] {d['ctx']} me={d['claude']} judge={d['judge']} {d['differ']}\n  {extra}\n  TEXT: {d['text'][:400]}\n  MINE: {json.dumps(mine, ensure_ascii=False)[:300]}\n  JUDGE: {json.dumps(d['judgeEvidence'], ensure_ascii=False)[:300]}")
print('new', n)
