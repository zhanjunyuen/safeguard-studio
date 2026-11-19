"""Compact view of contexts for writing items: python3 show.py <criterion> [id-substring ...]"""
import json, sys, os
d = os.path.join(os.path.dirname(__file__), 'data', 'contexts.jsonl')
crit, subs = sys.argv[1], sys.argv[2:]
for line in open(d):
    c = json.loads(line)
    if c['criterion'] != crit or (subs and not any(s in c['id'] for s in subs)): continue
    p, f = c['packet'], c['facts']
    if crit == 'testing':
        print(f"{c['id']} | {p['frozenBuild']} | " + '; '.join(f"{a['id']}={a['label']}/{a['title']}->{s['outcome']}" for a, s in zip(p['attackCases'], p['simulator'])))
    elif crit == 'anticipation':
        if c['id'].endswith(':struggles'): continue
        print(f"{c['id'].rsplit(':',1)[0]} | {p['frozenBuild']} | handled={f['handled']} ({p['simulator']['why'][:70]})")
    elif crit == 'revision':
        fails = [x['title'] for x in p['frozenResults'] if x['outcome'] != 'handled']
        lfails = [x['title'] for x in p['latestResults'] if x['outcome'] != 'handled']
        print(f"{c['id']} | {p['frozenBuild']} => {p['latestBuild']} | frozen fails: {fails} | latest fails: {lfails} | credits {p['creditsBefore']}->{p['creditsAfter']}")
    else:
        print(c['id'], json.dumps(f['anchors'].get('labels')))
