"""Prompts for pupil texts written by a non-Claude model (handoff §7 step 5: ~10% of pupil texts).

    python3 scripts/marking-data/second-model-prep.py  → data/second/input.jsonl

Each prompt shows the task as a pupil sees it and asks for an answer with a given content and
style. The model's text is an input only; Claude marks it afterwards from what it actually says.
"""
import json, os, random
HERE = os.path.dirname(__file__)
random.seed(20261118)
ctx = [json.loads(l) for l in open(os.path.join(HERE, 'data', 'contexts.jsonl'))]
STYLES = ['short and casual, with a couple of spelling mistakes', 'one or two clear sentences', 'a bit rambling, three or four sentences',
          'very short, like a text message', 'polite and formal', 'uses informal British slang']
CONTENT = {
  'testing': ['name the block that is missing or in the wrong place, and say which request will get through', 'only say which request you think will get through, with no reason',
              'give a vague guess without naming any block or request', 'name a block but predict the wrong request'],
  'anticipation': ['say what the risk is, why your blocks would not catch it, and who should check', 'only say what the risk is',
                   'say you think the helper will be fine, without naming a risk', 'say which block you think would catch it'],
  'judgement': ['use the current source, say what is still unconfirmed and who should confirm it', 'only correct one detail from the draft',
                'say to post the draft as it is', 'mention the open question but also repeat one out-of-date detail from the draft'],
  'revision': ['say what you changed, which test result made you change it, and what it costs and gains', 'only say what you changed',
               'say you kept it because of the credits', 'mention a test result but not what you did'],
}
def task(c):
    p = c['packet']
    if c['criterion'] == 'testing':
        return f"Your helper's blocks, in order: {p['frozenBuild']}. You chose these attacks: " + '; '.join(a['label'] for a in p['attackCases']) + ". Before launching, write which block you expect to fail and why."
    if c['criterion'] == 'anticipation':
        return f"Your helper's blocks: {p['frozenBuild']}. A new request arrives: \"{p['curveball']['request']}\"" + (f" ({p['curveball']['context']})" if p['curveball']['context'] else '') + f" You predicted: {p['pupilChoice']}. Explain why."
    if c['criterion'] == 'judgement':
        return f"Request: {p['request']} The helper's draft: \"{p['helperDraft']}\" Current source: \"{p['currentSource']}\" Decide what to do and explain what to tell families."
    return f"Your helper was: {p['frozenBuild']}. Now it is: {p['latestBuild']}. Explain why you changed or kept it."
picks = []
for crit, n in [('testing', 24), ('anticipation', 24), ('judgement', 20), ('revision', 16)]:
    pool = [c for c in ctx if c['criterion'] == crit and (crit != 'anticipation' or c['id'].endswith(':struggles') or random.random() < .3)]
    picks += [(c, i) for i, c in enumerate(random.sample(pool, n))]
os.makedirs(os.path.join(HERE, 'data', 'second'), exist_ok=True)
with open(os.path.join(HERE, 'data', 'second', 'input.jsonl'), 'w') as fh:
    for c, i in picks:
        content = CONTENT[c['criterion']][i % 4]
        style = STYLES[i % len(STYLES)]
        prompt = (f"You are a UK pupil aged 12 doing an AI-safety lesson. {task(c)}\n\nWrite ONLY the pupil's answer, nothing else. "
                  f"Content: {content}. Style: {style}. Under 60 words. Do not use quotation marks around the whole answer.")
        fh.write(json.dumps({'id': f"{c['id']}|{i % 4}", 'input': prompt}) + '\n')
print(len(picks), 'prompts')
