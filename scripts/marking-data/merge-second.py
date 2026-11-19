"""Merge second-model pupil texts (data/second/<model>.jsonl) with Claude's marks (data/second/marks.jsonl)
into data/items/s01-second-model.jsonl.  python3 scripts/marking-data/merge-second.py"""
import json, os
D = os.path.join(os.path.dirname(__file__), 'data')
T = {json.loads(l)['id']: (json.loads(l)['output_text'] or '').strip() for l in open(os.path.join(D, 'second', 'deepseek-v4-flash.jsonl'))}
L = [json.loads(l) for l in open(os.path.join(D, 'second', 'marks.jsonl')) if l.strip()]
out = [{'ctx': m['id'].split('|')[0], 'author': 'deepseek-v4-flash', 'tag': 'second-model:' + m['id'].split('|')[1], 'text': T[m['id']],
        **{x: m[x] for x in ('c', 'why', 'fb', 'ns')}, **({'flag': m['flag']} if 'flag' in m else {})} for m in L]
open(os.path.join(D, 'items', 's01-second-model.jsonl'), 'w').write('\n'.join(json.dumps(x, ensure_ascii=False) for x in out) + '\n')
print(len(out), 'second-model items')
