"""List built marking rows compactly for writing follow-ups: python3 list-items.py [criterion] [every-nth]"""
import json, sys, os
d = os.path.join(os.path.dirname(__file__), 'data', 'rows')
crit = sys.argv[1] if len(sys.argv) > 1 else None
nth = int(sys.argv[2]) if len(sys.argv) > 2 else 1
rows = [json.loads(l) for f in ('train.jsonl', 'test.jsonl') for l in open(os.path.join(d, f)) if l.strip()]
rows = [r for r in rows if r['kind'] == 'marking' and (not crit or r['criterion'] == crit)]
for i, r in enumerate(rows):
    if i % nth: continue
    m = json.loads(r['completion'])
    text = r['prompt'][r['prompt'].rfind('"""', 0, len(r['prompt']) - 4) + 3:-3]
    pres = ','.join(c['id'] for c in m['concepts'] if c['present']) or '-'
    print(f"{r['id']} | L{m['level']} | {pres} | {text[:110]}")
