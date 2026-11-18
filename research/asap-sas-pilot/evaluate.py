import pandas as pd, numpy as np
def qwk(a, b):
    a = np.asarray(a, int); b = np.asarray(b, int)
    lo, hi = min(a.min(), b.min()), max(a.max(), b.max()); k = hi - lo + 1
    O = np.zeros((k, k))
    for x, y in zip(a, b): O[x - lo, y - lo] += 1
    W = np.array([[(i - j) ** 2 for j in range(k)] for i in range(k)]) / (k - 1) ** 2
    E = np.outer(O.sum(1), O.sum(0)) / O.sum()
    return 1 - (W * O).sum() / (W * E).sum()
def boot(a, b, n=4000, seed=0):
    rng = np.random.default_rng(seed); a = np.asarray(a); b = np.asarray(b); v = []
    for _ in range(n):
        i = rng.integers(0, len(a), len(a))
        if len(set(a[i]) | set(b[i])) > 1: v.append(qwk(a[i], b[i]))
    return np.percentile(v, [2.5, 97.5])
rows = []
for s, col in (('set10', 'pred_b'), ('set10', 'pred_a'), ('set1', 'pred'), ('set1', 'pred_borderline')):
    d = pd.read_csv(f'data/labels_{s}.csv').merge(pd.read_csv(f'pred_{s}.csv'), on='Id')
    d = d.astype({'Score1': int, 'Score2': int})
    lo, hi = boot(d[col], d.Score1)
    rows.append(dict(set=s, rule=col, n=len(d),
        qwk_me_vs_score1=round(qwk(d[col], d.Score1), 3), ci95=f'[{lo:.2f}, {hi:.2f}]',
        qwk_me_vs_score2=round(qwk(d[col], d.Score2), 3),
        qwk_human1_vs_human2=round(qwk(d.Score1, d.Score2), 3),
        exact_me=round((d[col] == d.Score1).mean(), 2), exact_humans=round((d.Score1 == d.Score2).mean(), 2),
        mean_me=round(d[col].mean(), 2), mean_score1=round(d.Score1.mean(), 2),
        off_by_2plus=int((abs(d[col] - d.Score1) >= 2).sum())))
r = pd.DataFrame(rows); print(r.to_string(index=False)); r.to_csv('results_summary.csv', index=False)
for s, col in (('set10', 'pred_b'), ('set1', 'pred')):
    d = pd.read_csv(f'data/labels_{s}.csv').merge(pd.read_csv(f'pred_{s}.csv'), on='Id')
    dis = d[d[col] != d.Score1]
    print(f'\n{s} disagreements with Score1 ({len(dis)}):'); print(dis[['Id', 'Score1', 'Score2', col]].to_string(index=False))
