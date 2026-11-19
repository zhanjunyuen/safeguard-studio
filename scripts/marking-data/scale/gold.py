"""Claude-marked gold items from the generated pupil answers.

    python3 scripts/marking-data/scale/gold.py select          → data/scale/gold/queue.jsonl (one answer per generation call)
    python3 scripts/marking-data/scale/gold.py show <from> <n> → compact view of answers to mark, grouped by context
    python3 scripts/marking-data/scale/gold.py convert         → data/items/g01-gold.jsonl from data/scale/gold/marks/*.jsonl

Claude reads each answer and writes its verdicts in data/scale/gold/marks/*.jsonl, one line per answer:
    {"k": <queue index>, "c": {"A2": "exact quote", ...}, "f": "optional review flag"}
Concepts not listed are absent. For C4, a listed quote is the out-of-date claim (C4 absent);
not listing C4 means no out-of-date detail (C4 present). A1 is never given (the simulator decides it).
The reasons, feedback and next step are filled from the codebook templates below, driven by
Claude's verdicts. build.ts then validates every item like any other (quotes must be in the text).
"""
import json, os, random, sys, glob

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(HERE, 'data')
SET = os.environ.get('GOLD_SET', '1')  # '1' → g01 (queue.jsonl, marks/, feedback/), '2' → g02 (…2)
SUF = '' if SET == '1' else SET
G = os.path.join(D, 'scale', 'gold')
os.makedirs(os.path.join(G, 'marks' + SUF), exist_ok=True)
os.makedirs(os.path.join(G, 'feedback' + SUF), exist_ok=True)
CTX = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'contexts.jsonl'))}
IDS = {'testing': ['T1', 'T2', 'T3'], 'anticipation': ['A2', 'A3', 'A4'], 'judgement': ['C1', 'C2', 'C3', 'C4'], 'revision': ['R1', 'R2', 'R3', 'R4']}

LABEL = {
    'T1': 'names a block in the helper, or a safeguard it is missing', 'T2': 'says what kind of request should get through',
    'T3': 'predicts what the attack actually showed',
    'A2': 'names the risk in this case', 'A3': 'links it to a block: what it covers, misses, or where it sits', 'A4': 'suggests a sensible person or real-world check',
    'C1': 'uses the current source for the fact that changed', 'C2': 'spots the detail the source still leaves open',
    'C3': 'gives the open question to the right person', 'C4': 'does not repeat out-of-date details',
    'R1': 'says what was changed, or that the build was kept', 'R2': 'cites evidence from a test, attack or replay',
    'R3': 'states a consequence for safety, usefulness or workload', 'R4': 'compares at least two of safety, usefulness and workload',
}
FEEDBACK = {
    'T1': ('Not yet shown: which block in your helper is involved.', 'Which block would stop this request, and is it in your helper in the right place?'),
    'T2': ('Not yet shown: what kind of request should still get through.', 'Which normal request should the helper still answer?'),
    'T3': ('Your prediction did not match what the attack showed.', 'Look at the attack results: which request actually got through, and why?'),
    'A2': ('Not yet shown: the specific risk in this case.', 'What exactly could go wrong with this request?'),
    'A3': ('Not yet shown: how your blocks deal with it, or why they miss it.', 'Which of your blocks looks at this, and what does it check?'),
    'A4': ('Good reasoning. You could also say who could check it in real life.', 'Which person, or what real-world check, would settle it?'),
    'C1': ('Not yet shown: the up-to-date detail from the current source.', 'What does the current source say that the draft gets wrong?'),
    'C2': ('Not yet shown: what the source still leaves open.', 'What isn\'t decided yet, according to the source?'),
    'C3': ('Not yet shown: who should confirm the open question.', 'Who would know the answer, and when?'),
    'C4': ('Careful: your answer repeats an out-of-date detail from the draft.', 'Which detail in the draft came from last year\'s information?'),
    'R1': ('Not yet shown: what you changed, or that you kept it.', 'What exactly did you change in the build?'),
    'R2': ('Not yet shown: the test or replay result behind your decision.', 'Which test result made you decide this?'),
    'R3': ('Not yet shown: what the change means for safety, usefulness or credits.', 'What does your decision gain or cost?'),
    'R4': ('Not yet shown: a comparison, such as safety against credits.', 'Was the gain worth the cost? Compare two things.'),
}
PRAISE = {
    'testing': ('You named the block and predicted what the attack showed.', 'How would you fix the helper so that request is caught?'),
    'anticipation': ('Right prediction, a clear risk, and you linked it to your blocks.', 'How could you test the helper for this risk?'),
    'judgement': ('You used the current source, kept the open question open and said who decides.', 'How would you word this for a parent who only reads the first line?'),
    'revision': ('You named the change, backed it with evidence and weighed the trade-off.', 'Would you make the same choice with half the credits?'),
}

def challenge(cid):
    return cid.split(':')[1].split('@')[0]

def select():
    gen = [json.loads(l) for l in open(os.path.join(D, 'scale', 'answers.jsonl'))]
    by_call = {}
    for a in gen:
        by_call.setdefault(a['call'], []).append(a)
    random.seed(1447)
    queue = [random.choice(v) for _, v in sorted(by_call.items())]
    # Exclude the 46 calibration texts' contexts? No: these are new texts. Keep order grouped by context.
    queue.sort(key=lambda a: (CTX[a['ctx']]['criterion'], a['ctx'], a['id']))
    with open(os.path.join(G, f'queue{SUF}.jsonl'), 'w') as fh:
        for i, a in enumerate(queue):
            fh.write(json.dumps({'k': i, **a}, ensure_ascii=False) + '\n')
    import collections
    print(len(queue), 'answers', dict(collections.Counter(CTX[a['ctx']]['criterion'] for a in queue)))

def select2(n=160):
    """Answers written to the 'complete answer' target (content 0) that g01 did not use, one per context."""
    used = {json.loads(l)['id'] for l in open(os.path.join(G, 'queue.jsonl'))}
    gen = [json.loads(l) for l in open(os.path.join(D, 'scale', 'answers.jsonl'))]
    cand = [a for a in gen if a['content'] == 0 and a['id'] not in used]
    random.seed(2002)
    random.shuffle(cand)
    seen, out = set(), []
    for a in cand:
        if a['ctx'] in seen:
            continue
        seen.add(a['ctx']); out.append(a)
        if len(out) == n:
            break
    out.sort(key=lambda a: (CTX[a['ctx']]['criterion'], a['ctx']))
    with open(os.path.join(G, 'queue2.jsonl'), 'w') as fh:
        for i, a in enumerate(out):
            fh.write(json.dumps({'k': i, **a}, ensure_ascii=False) + '\n')
    import collections
    print(len(out), dict(collections.Counter(CTX[a['ctx']]['criterion'] for a in out)))

def facts(c):
    """The facts a marker needs, in one or two lines."""
    p, f = c['packet'], c['facts']
    crit = c['criterion']
    if crit == 'testing':
        sim = ', '.join(f"{s['case']}={'BROKE' if s['outcome'] == 'got through' else 'held'}" for s in p['simulator'])
        atk = '; '.join(f"{a['id']}: {a['label']}" for a in p['attackCases'])
        return f"build: {p['frozenBuild']}\n  attacks: {atk}\n  result: {sim}"
    if crit == 'anticipation':
        cb = p['curveball']
        return (f"build: {p['frozenBuild']}\n  ask: {cb['request'][:160]} | risk: {cb['risk']}\n"
                f"  choice: {p['pupilChoice']} | handled={f['handled']} → A1={'yes' if f['predictionCorrect'] else 'NO'}")
    if crit == 'judgement':
        L = f['anchors']['labels']
        return f"current: {L['current']} | open: {L['open']} | person: {L['person']} | STALE: {L['stale']}"
    fails = [r['title'] for r in p['frozenResults'] if r['outcome'] != 'handled']
    after = [r['title'] for r in p['latestResults'] if r['outcome'] != 'handled']
    return (f"before: {p['frozenBuild']}\n  after:  {p['latestBuild']} ({'changed' if p['changed'] else 'KEPT'})\n"
            f"  failing before: {fails} | after: {after} | credits {p['creditsBefore']}→{p['creditsAfter']}")

def show(start, n):
    """Compact view: challenge-wide details once, then per-context facts, then the answers."""
    q = [json.loads(l) for l in open(os.path.join(G, f'queue{SUF}.jsonl'))][start:start + n]
    last_ch = last_ctx = None
    for a in q:
        c = CTX[a['ctx']]; p, f = c['packet'], c['facts']; crit = c['criterion']
        ch = (crit, a['ctx'].split(':')[1])
        if ch != last_ch:
            last_ch = ch
            if crit == 'anticipation':
                print(f"\n#### {ch[1]} ASK: {p['curveball']['request'][:170]} | RISK: {p['curveball']['risk']}")
            elif crit == 'testing':
                print(f"\n#### {ch[1]} ATTACKS: " + '; '.join(f"{x['id']}={x['label']}" for x in p['attackCases']))
            elif crit == 'judgement':
                L = f['anchors']['labels']
                print(f"\n#### {ch[1]} CURRENT: {L['current']} | OPEN: {L['open']} | PERSON: {L['person']} | STALE: {L['stale']}")
            else:
                print(f"\n#### {ch[1]}")
        if a['ctx'] != last_ctx:
            last_ctx = a['ctx']
            if crit == 'anticipation':
                print(f"  ~ {p['frozenBuild']} | {'cope' if 'cope' in p['pupilChoice'] else 'gets through'} | A1={'yes' if f['predictionCorrect'] else 'NO'}")
            elif crit == 'testing':
                print(f"  ~ {p['frozenBuild']} | BROKE: {[s['case'] for s in p['simulator'] if s['outcome'] == 'got through'] or 'none'}")
            elif crit == 'revision':
                fails = [r['title'] for r in p['frozenResults'] if r['outcome'] != 'handled']
                after = [r['title'] for r in p['latestResults'] if r['outcome'] != 'handled']
                print(f"  ~ {p['frozenBuild']}  ==>  {p['latestBuild'] if p['changed'] else 'KEPT'} | fail before {fails} after {after} | {p['creditsBefore']}→{p['creditsAfter']}")
        print(f"[{a['k']}] {a['text']}")


def level_of(crit, ctx, c):
    """Same rule as levelFor (without the <4-words null case, which build.ts handles)."""
    has = lambda i: (c.get(i) is None) if i == 'C4' else (c.get(i) is not None)
    if crit == 'testing':
        return 2 if has('T1') and has('T3') else 1 if has('T1') or has('T2') else 0
    if crit == 'anticipation':
        a1 = ctx['facts']['predictionCorrect']
        return 2 if a1 and has('A2') and has('A3') else 1 if has('A2') or has('A3') else 0
    if crit == 'judgement':
        return 2 if all(has(i) for i in ('C1', 'C2', 'C3', 'C4')) else 1 if has('C1') or has('C2') or has('C3') else 0
    return 2 if has('R1') and has('R2') and has('R4') else 1 if has('R2') or has('R3') else 0

def fbview(start, n):
    """Compact view for writing feedback: challenge facts once, then each answer with Claude's verdicts and level."""
    q = [json.loads(l) for l in open(os.path.join(G, f'queue{SUF}.jsonl'))]
    items = [json.loads(l) for l in open(os.path.join(D, 'items', f'g0{SET}-gold.jsonl'))]
    last_ch = last_ctx = None
    for k in range(start, min(start + n, len(q))):
        a, it = q[k], items[k]
        c_ = CTX[a['ctx']]; p, f = c_['packet'], c_['facts']; crit = c_['criterion']
        ch = (crit, a['ctx'].split(':')[1])
        if ch != last_ch:
            last_ch = ch
            if crit == 'anticipation':
                print(f"\n#### {ch[1]} ASK: {p['curveball']['request'][:150]} | RISK: {p['curveball']['risk']}")
            elif crit == 'judgement':
                L = f['anchors']['labels']
                print(f"\n#### {ch[1]} CURRENT: {L['current']} | OPEN: {L['open']} | PERSON: {L['person']} | STALE: {L['stale']}")
            else:
                print(f"\n#### {ch[1]}")
        if a['ctx'] != last_ctx and crit != 'judgement':
            last_ctx = a['ctx']
            if crit == 'anticipation':
                print(f"  ~ {p['frozenBuild']} | {'cope' if 'cope' in p['pupilChoice'] else 'gets through'} | handled={f['handled']}")
            elif crit == 'testing':
                print(f"  ~ {p['frozenBuild']} | BROKE: {[x['case'] for x in p['simulator'] if x['outcome'] == 'got through'] or 'none'}")
            else:
                fails = [r['title'] for r in p['frozenResults'] if r['outcome'] != 'handled']
                after = [r['title'] for r in p['latestResults'] if r['outcome'] != 'handled']
                print(f"  ~ {'KEPT' if not p['changed'] else 'CHANGED'} | fail before {fails} after {after} | {p['creditsBefore']}→{p['creditsAfter']}")
        cc = it['c']
        got = [i for i in IDS[crit] if (cc[i] is None if i == 'C4' else cc[i] is not None)]
        miss = [i for i in IDS[crit] if i not in got]
        a1 = '' if crit != 'anticipation' else f" A1={'Y' if f['predictionCorrect'] else 'N'}"
        print(f"[{k}] L{level_of(crit, c_, cc)}{a1} +{','.join(got) or '-'} -{','.join(miss) or '-'}{' FLAG' if it.get('flag') else ''} | {a['text']}")

def reason(cid, quote, ctx):
    """Why a concept is present or absent, in terms of this task's simulator facts (the attack results,
    the curveball's risk, the scenario anchors, the replay), so the reasoning trace says why, not just which."""
    p, f = ctx['packet'], ctx['facts']
    yes = quote is not None
    if cid[0] == 'T':
        broke = [a['label'] for a in p['attackCases'] if a['id'] in f['broke']] or ['nothing']
        return {
            'T1': (f"Names part of this build ({p['frozenBuild']}) or a safeguard it lacks.",
                   f"Names no block in this build ({p['frozenBuild']}) and no safeguard it lacks."),
            'T2': ("Names a kind of request and says it gets through (or should be answered).",
                   "Does not say which kind of request gets through."),
            'T3': (f"The attack showed: {'; '.join(broke)} got through. The prediction matches.",
                   f"The attack showed: {'; '.join(broke)} got through. The answer does not predict that."),
        }[cid][0 if yes else 1]
    if cid[0] == 'A':
        risk = p['curveball']['risk']
        return {
            'A2': (f"Names the risk in this case ({risk}).", f"Does not name the risk in this case ({risk})."),
            'A3': (f"Links the request to this build ({p['frozenBuild']}): what a block covers, misses or where it sits.",
                   f"No reasoned link to this build ({p['frozenBuild']})."),
            'A4': ("Suggests a person or real-world check that could settle it.", "No person or real-world check is suggested."),
        }[cid][0 if yes else 1]
    if cid[0] == 'C':
        L = f['anchors']['labels']
        return {
            'C1': (f"Gives the current detail ({L['current']}).", f"Does not give the current detail ({L['current']})."),
            'C2': (f"Says {L['open']} is still open.", f"Does not say {L['open']} is still undecided."),
            'C3': (f"Passes the open question to {L['person']}.", f"Does not pass the open question to {L['person']}."),
            'C4': (f"Repeats the out-of-date detail ({L['stale']}) as true.", f"Does not repeat the out-of-date detail ({L['stale']})."),
        }[cid][0 if yes else 1]
    kept = not p['changed']
    fails = [r['title'] for r in p['frozenResults'] if r['outcome'] != 'handled'] or ['none']
    return {
        'R1': (f"Says what happened to the build (the replay shows it was {'kept' if kept else 'changed'}).",
               f"Does not truly say what happened to the build (the replay shows it was {'kept' if kept else 'changed'})."),
        'R2': (f"Cites a test result that matches the replay (failing before: {'; '.join(fails)}).",
               f"Cites no test result that matches the replay (failing before: {'; '.join(fails)})."),
        'R3': (f"States a consequence for safety, usefulness or workload (credits {p['creditsBefore']} to {p['creditsAfter']}).",
               "States no consequence for safety, usefulness or workload."),
        'R4': ("Weighs two of safety, usefulness and workload against each other.",
               "Does not weigh safety, usefulness and workload against each other."),
    }[cid][0 if yes else 1]

def convert():
    q = {json.loads(l)['k']: json.loads(l) for l in open(os.path.join(G, f'queue{SUF}.jsonl'))}
    FB = {}
    for f in sorted(glob.glob(os.path.join(G, 'feedback' + SUF, '*.jsonl'))):
        for line in open(f):
            if line.strip():
                o = json.loads(line); FB[o['k']] = o
    items, seen = [], set()
    for f in sorted(glob.glob(os.path.join(G, 'marks' + SUF, '*.jsonl'))):
        for line in open(f):
            if not line.strip():
                continue
            m = json.loads(line)
            if m['k'] in seen:
                continue
            seen.add(m['k'])
            a = q[m['k']]
            crit = CTX[a['ctx']]['criterion']
            given = m.get('c', {})
            c, why = {}, {}
            for cid in IDS[crit]:
                quote = given.get(cid)
                c[cid] = quote
                why[cid] = reason(cid, quote, CTX[a['ctx']])
            missing = [cid for cid in IDS[crit] if (c[cid] is not None if cid == 'C4' else c[cid] is None)]
            if crit == 'anticipation' and not CTX[a['ctx']]['facts']['predictionCorrect']:
                fb, ns = ('Your prediction did not match what happened: check the replay.', 'What did the helper actually do with this request, and why?')
                if missing and missing[0] != 'A4':
                    fb = FEEDBACK[missing[0]][0] + ' Your prediction also did not match what happened.'
                    ns = FEEDBACK[missing[0]][1]
            elif missing:
                fb, ns = FEEDBACK[missing[0]]
            else:
                fb, ns = PRAISE[crit]
            fbo = FB.get(m['k'])
            if fbo:
                fb, ns = fbo['fb'], fbo['ns']
            item = {'ctx': a['ctx'], 'tag': f'gold{SUF}:claude', 'author': a['author'], 'text': a['text'], 'c': c, 'why': why, 'fb': fb, 'ns': ns}
            if m.get('f'):
                item['flag'] = m['f']
            items.append(item)
    with open(os.path.join(D, 'items', f'g0{SET}-gold.jsonl'), 'w') as fh:
        fh.write(''.join(json.dumps(i, ensure_ascii=False) + '\n' for i in items))
    print(len(items), 'gold items written')

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'select':
        select()
    elif cmd == 'show':
        show(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == 'select2':
        select2()
    elif cmd == 'fbview':
        fbview(int(sys.argv[2]), int(sys.argv[3]))
    elif cmd == 'convert':
        convert()
