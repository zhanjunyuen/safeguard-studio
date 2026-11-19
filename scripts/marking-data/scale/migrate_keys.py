"""One-off (18 Nov): move follow-up and summary references from shifting keys to file-scoped keys.

Old keys were `ctx#n`, counted across every item file in name order, so adding a file that sorts
before s01-second-model.jsonl (b09–b12, g01, g02) renumbered every s01 item and silently attached
follow-ups to a different pupil answer. New keys are `ctx#<file stem>.<n>` (n counted within that
file), so adding a file never changes an existing key. Each reference file is resolved with the item
files as they were when it was written, then matched to today's items by (ctx, pupil text).
"""
import json, os, subprocess, collections
D = 'data'
if '#b01.' in open(os.path.join(D, 'followups', 'f01.jsonl')).read() and not os.environ.get('MIGRATE_JUDGE'):
    raise SystemExit('Already migrated (18 Nov); running it again would fail on the new keys.')
ITEMS = os.path.join(D, 'items')

def stem(f): return os.path.basename(f).split('-')[0]

def old_keys(files):
    """files: list of (name, [item dicts]) in name order → {old key: (name, ctx, text)} using the old rule."""
    count, out = {}, {}
    for name, items in files:
        for it in items:
            robust = str(it.get('tag', '')).startswith('robust')
            ck = it['ctx'] + ('~r' if robust else '')
            n = count.get(ck, 0); count[ck] = n + 1
            out[f"{it['ctx']}#{'r' if robust else ''}{n}"] = (name, it['ctx'], it['text'])
    return out

def load(text): return [json.loads(l) for l in text.splitlines() if l.strip()]

def at_commit(c):
    names = subprocess.run(['git', 'ls-tree', '--name-only', c, 'data/items/'], capture_output=True, text=True, check=True).stdout.split()
    return [(os.path.basename(n), load(subprocess.run(['git', 'show', f'{c}:scripts/marking-data/{n}'], capture_output=True, text=True, check=True).stdout)) for n in sorted(names)]

def now(exclude=()):
    return [(f, load(open(os.path.join(ITEMS, f)).read())) for f in sorted(os.listdir(ITEMS)) if f.endswith('.jsonl') and f not in exclude]

# Today's items → new key, looked up by (file, ctx, text); duplicates are consumed in order.
NEW = collections.defaultdict(list)
for name, items in now():
    count = {}
    for it in items:
        n = count.get(it['ctx'], 0); count[it['ctx']] = n + 1
        NEW[(name, it['ctx'], it['text'])].append(f"{it['ctx']}#{stem(name)}.{n}")

def resolver(files):
    old = old_keys(files)
    def r(key):
        name, ctx, text = old[key]
        hits = NEW.get((name, ctx, text))
        if not hits: raise KeyError(f'{key}: no current item in {name} with that text')
        return hits[0]
    return r

SOURCES = {
    'followups/f01.jsonl': at_commit('fbf83b5'),
    'followups/f02.jsonl': at_commit('9e30f86'),
    'followups/f03.jsonl': now(exclude={'g02-gold.jsonl'}),
    'followups/f04.jsonl': now(exclude={'g02-gold.jsonl'}),
    'followups/f05.jsonl': now(exclude={'g02-gold.jsonl'}),
    'summaries/s01.jsonl': now(exclude={'g02-gold.jsonl'}),
}
moved = collections.Counter()
for path, files in SOURCES.items():
    r = resolver(files)
    p = os.path.join(D, path); out = []
    for l in open(p):
        if not l.strip(): continue
        o = json.loads(l)
        if 'item' in o:
            new = r(o['item']); moved[(path, o['item'].split('#')[1][0] != new.split('#')[1][0])] += 0
            if o['item'] != new: moved[path] += 1
            o['item'] = new
        else:
            o['items'] = {c: r(k) for c, k in o['items'].items()}
        out.append(json.dumps(o, ensure_ascii=False))
    open(p, 'w').write('\n'.join(out) + '\n')
    print(path, 'rewritten')

# Judge files (blind second-model run, commit 2077d64): ids are old keys over that commit's item files.
# Each mapping is checked against the pupil text inside the judge prompt.
if __name__ == '__main__' and os.environ.get('MIGRATE_JUDGE'):
    files = at_commit('2077d64')
    old = old_keys(files)
    inp = {json.loads(l)['id']: json.loads(l) for l in open(os.path.join(D, 'judge', 'input.jsonl')) if l.strip()}
    def r(key):
        name, ctx, text = old[key]
        if key in inp: assert text.strip()[:60] in inp[key]['input'], key
        return NEW[(name, ctx, text)][0]
    for fn in ('input.jsonl', 'qwen3.5-397b.jsonl', 'hard-cases.jsonl'):
        p = os.path.join(D, 'judge', fn); out = []
        for l in open(p):
            if not l.strip(): continue
            o = json.loads(l); o['id'] = r(o['id']); out.append(json.dumps(o, ensure_ascii=False))
        open(p, 'w').write('\n'.join(out) + '\n')
        print(fn, 'migrated')
