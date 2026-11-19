"""Writes the files uploaded to Adaption (handoff §7 step 6).

    python3 scripts/marking-data/export.py

Reads data/rows/{train,test}.jsonl and data/judge/hard-cases.jsonl, and writes
  data/adaption/train.jsonl   prompt, completion, reasoning_trace (flat columns: Adaption's raw
                              mode rejects chat-format rows; see docs/adaption-handoff.md §5)
  data/adaption/test.jsonl    held-out rows (whole challenges and scenarios), never uploaded
  data/adaption/hard-cases.jsonl  rows where the blind second model's level disagreed with
                              Claude's; left out of training (handoff §6.2)
  data/adaption/summary.json  counts by kind, criterion, level, author; length stats
Follow-up rows are kept unless the marking row they explain is a hard case.

Reasoning trace: Adaption's raw upload keeps only prompt and completion (checked 19 Nov: a mapped
reasoning_trace column is dropped), so the trace is folded into the completion itself, as the first
field, so the model writes its reasoning before the level:
  marks and summaries  {"reasoning": "<trace>", "criterion": ..., ...}
  follow-ups           {"reasoning": "<trace>", "answer": "<reply to the pupil>"}
The app's model provider must parse this JSON and never show `reasoning` to pupils.
TRACE_IN_COMPLETION=0 writes the old completions (trace only in its own column).
"""
import json, os, collections

TRACE_IN_COMPLETION = os.environ.get('TRACE_IN_COMPLETION', '1') == '1'

def completion(r):
    """The completion as uploaded: the reasoning trace first, then the answer (see the docstring)."""
    if not TRACE_IN_COMPLETION:
        return r['completion']
    if r['kind'] == 'followup':
        return json.dumps({'reasoning': r['reasoning_trace'], 'answer': r['completion']}, ensure_ascii=False)
    return json.dumps({'reasoning': r['reasoning_trace'], **json.loads(r['completion'])}, ensure_ascii=False)

D = os.path.join(os.path.dirname(__file__), 'data')
OUT = os.path.join(D, 'adaption')
os.makedirs(OUT, exist_ok=True)
read = lambda p: [json.loads(l) for l in open(p) if l.strip()] if os.path.exists(p) else []
hard = {h['id'] for h in read(os.path.join(D, 'judge', 'hard-cases.jsonl'))}
judged = {o['id'] for o in read(os.path.join(D, 'judge', 'qwen3.5-397b.jsonl'))}

summary = {}
for split in ('train', 'test'):
    rows = read(os.path.join(D, 'rows', f'{split}.jsonl'))
    keep, dropped = [], []
    for r in rows:
        base = r['id'].split('?')[0]
        if r['id'] in hard or (r['kind'] == 'followup' and base in hard):
            dropped.append(r)
        else:
            keep.append(r)
    cols = ['prompt', 'completion', 'reasoning_trace']
    with open(os.path.join(OUT, f'{split}.jsonl'), 'w') as fh:
        for r in keep:
            fh.write(json.dumps({**{c: r[c] for c in cols}, 'completion': completion(r), 'id': r['id'], 'kind': r['kind'], 'criterion': r['criterion']}, ensure_ascii=False) + '\n')
    if split == 'train':
        with open(os.path.join(OUT, 'hard-cases.jsonl'), 'w') as fh:
            fh.write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in dropped))
    chars = sorted(len(r['prompt']) + len(r['completion']) + len(r['reasoning_trace']) for r in keep)
    by = lambda k: dict(collections.Counter(str(r[k]) for r in keep))
    summary[split] = {'rows': len(keep), 'droppedHardCases': len(dropped),
                      'judgedRows': sum(1 for r in rows if r['id'] in judged), 'notYetJudged': sum(1 for r in rows if r['kind'] != 'followup' and r['id'] not in judged),
                      'byKind': by('kind'), 'byCriterion': by('criterion'), 'byLevel': by('level'), 'byAuthor': by('author'),
                      'charsMedian': chars[len(chars) // 2] if chars else 0, 'charsMax': chars[-1] if chars else 0,
                      'approxTokensMax': (chars[-1] // 4) if chars else 0}
json.dump(summary, open(os.path.join(OUT, 'summary.json'), 'w'), indent=1)
print(json.dumps(summary, indent=1))
