"""Stage 1 of the scaled pipeline: prompts for pupil answers written by Adaption's hosted models.

    python3 scripts/marking-data/scale/gen-prep.py

Writes data/scale/gen/input.jsonl (one row per call; each row names its generator model). The model's text is
an INPUT only: two other hosted models mark it blind, and our validator gates it (mark.py).
Only training contexts are used: held-out challenges and scenarios never get scaled rows.

Each prompt shows the task the way a pupil sees it, plus a content target (what the answer should
and should not contain, so levels spread from 0 to 2) and a writing style, so the set covers
many kinds of pupil.
"""
import json, os, random

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# GEN_HOLDOUT=1 writes answers for the held-out challenges and scenarios only, to data/scale/gen-test/,
# for the evaluation set; they never enter training (build.ts puts held-out contexts in `test`).
HOLDOUT = os.environ.get('GEN_HOLDOUT') == '1'
OUT = os.path.join(HERE, 'data', 'scale', 'gen-test' if HOLDOUT else 'gen')
os.makedirs(OUT, exist_ok=True)
random.seed(20261119 + (7 if os.environ.get('GEN_HOLDOUT') == '1' else 0))

HELD_OUT = {'coding', 'firstaid', 'gamemod'}
ctx = [json.loads(l) for l in open(os.path.join(HERE, 'data', 'contexts.jsonl'))]
challenge = lambda c: c['id'].split(':')[1].split('@')[0]
train = [c for c in ctx if (challenge(c) in HELD_OUT or c['holdOut']) == HOLDOUT]

# How many answers per context, by criterion (judgement has only 26 scenarios, so it gets many).
PER_CONTEXT = {'testing': 20, 'anticipation': 12, 'revision': 12, 'judgement': 150}
if HOLDOUT:  # enough to pick a balanced evaluation set from
    PER_CONTEXT = {'testing': 8, 'anticipation': 8, 'revision': 8, 'judgement': 40}

# Generator models, used in turn so no single model's voice dominates.
GENERATORS = ['deepseek-v4-flash', 'glm-5.3-flash', 'gemma-4-26b-a4b-it', 'qwen3.8-27b', 'glm-5.2', 'gemma-4-31b-it']

STYLES = [
    'short and casual, with a couple of spelling mistakes', 'one or two clear sentences', 'a bit rambling, three or four sentences',
    'very short, like a text message', 'polite and formal', 'uses informal British slang',
    'written by a pupil still learning English: simple words, some grammar mistakes', 'unsure, with phrases like "I think" and "maybe"',
    'very confident and direct', 'lists points with dashes', 'written by a pupil with dyslexia: phonetic spellings, no capitals',
    'chatty, starts with "so basically"',
]

CONTENT = {
  'testing': [
    'name the block that is missing or in the wrong place, and say which request will get through and why',
    'name one of your blocks and say what it does, but do not predict a request',
    'only say which request you think will get through, with no reason',
    'give a vague guess without naming any block or request',
    'name a block but predict the wrong request will get through',
    'say every request will be fine because the helper has blocks',
    'say what kind of request should still be answered normally, and name a block',
    'say a block is in the wrong order and which request that lets through',
  ],
  'anticipation': [
    'say what the risk is in this exact case, why your blocks would or would not catch it, and who or what could check',
    'only say what the risk is in this case',
    'say you think the helper will be fine, without naming a risk',
    'say which one of your blocks you think will deal with it, and why',
    'say something general like "AI can be wrong", nothing specific',
    'name a different risk from the real one (for example privacy when it is about a fake source)',
    'name the risk and suggest a real person or real-world check, but do not mention any block',
    'explain how the order of your blocks matters for this request',
  ],
  'judgement': [
    'use the current source, say what is still unconfirmed and who should confirm it',
    'only correct one detail from the draft using the current source',
    'say to post the draft as it is',
    'mention the open question but also repeat one out-of-date detail from the draft',
    'say who to check with, but do not give any facts',
    'give the correct new details and say not to use last year\'s information, but forget the open question',
    'rewrite the message for families with all the correct details and the open question',
    'say it looks fine but to add a line saying "check with school"',
  ],
  'revision': [
    'say what you changed, which test result made you change it, and what it costs and gains',
    'only say what you changed',
    'say you kept it because of the credits',
    'mention a test result but not what you did',
    'say it is better now, without saying what changed or why',
    'say what you changed and that it is safer, but give no test result',
    'compare safety with the credit cost, and name the change',
    'claim every test passed (even if some failed) and that you kept it',
  ],
}

def results(rs):
    return '; '.join(f"{r['title']}: {r['outcome']}" for r in rs)

def task(c):
    """The task as the pupil sees it, in plain words."""
    p = c['packet']
    crit = c['criterion']
    if crit == 'testing':
        return (f"Challenge: {p['challenge']} ({p['audience']}). Your helper's blocks, in order: {p['frozenBuild']}. "
                f"You chose these attacks: " + '; '.join(a['label'] for a in p['attackCases']) +
                ". Before launching, write which attack you expect to get through and why.")
    if crit == 'anticipation':
        cb = p['curveball']
        return (f"Challenge: {p['challenge']}. Your helper's blocks: {p['frozenBuild']}. A new request arrives: \"{cb['request']}\""
                + (f" ({cb['context']})" if cb.get('context') else '') + f" You predicted: {p['pupilChoice']}. Explain why.")
    if crit == 'judgement':
        return (f"Request: {p['request']} The helper's draft: \"{p['helperDraft']}\" Current source: \"{p['currentSource']}\" "
                "Decide what to do and explain what to tell families.")
    return (f"Challenge: {p['challenge']}. Your helper was: {p['frozenBuild']} (tests: {results(p['frozenResults'])}; {p['creditsBefore']} credits). "
            f"Now it is: {p['latestBuild']} (tests: {results(p['latestResults'])}; {p['creditsAfter']} credits). "
            "Explain why you changed it or kept it.")

# The account allows 25 requests a minute, so each call writes up to PER_CALL answers for one context.
PER_CALL = 12
rows, n = [], 0
for c in train:
    k = PER_CONTEXT[c['criterion']]
    contents = CONTENT[c['criterion']]
    specs = [(i, contents[i % len(contents)], random.choice(STYLES)) for i in range(k)]
    for b in range(0, k, PER_CALL):
        chunk = specs[b:b + PER_CALL]
        model = GENERATORS[n % len(GENERATORS)]
        n += 1
        listing = '\n'.join(f"{j + 1}. Content: {content}. Style: {style}." for j, (_, content, style) in enumerate(chunk))
        prompt = (f"You are writing realistic answers from different UK pupils aged 11-14 doing an AI-safety lesson. {task(c)}\n\n"
                  f"Write {len(chunk)} different pupils' answers, one for each line below, each under 70 words and in that pupil's own voice. "
                  f"Do not mention these instructions.\n{listing}\n\n"
                  f"Reply with a JSON array of exactly {len(chunk)} strings, in the same order, and nothing else.")
        rows.append({'id': f"{c['id']}|b{b // PER_CALL}", 'model': model, 'input': prompt, 'ctx': c['id'],
                     'specs': [{'i': i, 'content': i % len(contents)} for i, _, _ in chunk]})
random.shuffle(rows)
with open(os.path.join(OUT, 'input.jsonl'), 'w') as fh:
    fh.write(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
print(len(rows), 'calls for', sum(len(r['specs']) for r in rows), 'answers')
