"""Re-implementation of jgf1123/asap_sas_scoring codes->score rules (set1 v0.2, set10 v1.2), written from their rubric.md."""
import csv

def has(flags, name): return name in str(flags).split(';')

def score10(r, cfg):
    f = r['flags']; n = bool(r['N'])
    if has(f, 'hyp') and cfg['B3'] == 'a': n = False
    if has(f, 'vague') and cfg['B4'] == 'a': n = False
    p = bool(r['P']) and n
    effect = bool(r['E'] or r['J'])
    full = (p and effect) if r['group'] == 'gray' else (n and bool(r['E'] or r['D']))
    if full: return 1 if (has(f, 'mismatch') and cfg['B5'] == 'b') else 2
    if r['U']: return 0
    if has(f, 'consistency') and not p: return int(effect) if cfg['B1'] == 'b' else 0
    if r['L'] and n and not p: return int(effect) if cfg['B2'] == 'b' else 0
    if effect or n: return 1
    if has(f, 'physics') or r['D']: return 1 if cfg['B6'] == 'b' else 0
    return 0

PIECES = ['VA', 'VT', 'MAT', 'SIZE', 'RT', 'DRY']
def score1(present, border, min_level=2):
    lv = {c: 2 for c in present.split(';') if c}
    for c in border.split(';'):
        if c: lv.setdefault(c, 1)
    on = lambda k: lv.get(k, 0) >= min_level
    n = sum(on(k) for k in PIECES) + (on('CS') or on('CT')) + (on('ENVT') or on('ENVL') or on('ENVP')) + on('COVER')
    return min(n, 3)

if __name__ == '__main__':
    B = {f'B{i}': 'b' for i in range(1, 7)}; A = {f'B{i}': 'a' for i in range(1, 7)}
    with open('pred_set10.csv', 'w') as o:
        o.write('Id,pred_b,pred_a\n')
        for r in csv.DictReader(open('codes_set10.csv')):
            rr = dict(r)
            for k in 'EJDNPLU': rr[k] = int(r[k])
            o.write(f"{r['Id']},{score10(rr, B)},{score10(rr, A)}\n")
    with open('pred_set1.csv', 'w') as o:
        o.write('Id,pred,pred_borderline\n')
        for r in csv.DictReader(open('codes_set1.csv')):
            o.write(f"{r['Id']},{score1(r['present'], r['borderline'])},{score1(r['present'], r['borderline'], 1)}\n")
    print('scored')
