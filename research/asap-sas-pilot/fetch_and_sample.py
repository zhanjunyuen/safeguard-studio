"""Rebuild the blind pilot sample and its labels (not committed: ASAP-SAS texts and scores stay out of the repo).

Data: nlpatunt/D_ASAP-SAS on Hugging Face (mirror of the Kaggle ASAP-SAS training data; no licence tag,
Kaggle competition rules apply, so use for evaluation only and do not redistribute).
Excludes the 300 Set 1 development responses that jgf1123/asap_sas_scoring wrote its codebook from.
Set 10 development IDs are not published, so up to ~18% of the Set 10 sample may overlap them.

Run from this folder:  python fetch_and_sample.py   -> data/blind_set*.txt, data/labels_set*.csv
"""
import io, os, urllib.request
import pandas as pd

HF = 'https://huggingface.co/datasets/nlpatunt/D_ASAP-SAS/resolve/main/{}.csv'
DEV1 = 'https://raw.githubusercontent.com/jgf1123/asap_sas_scoring/main/set1/results/baselines_dev_predictions.csv'
get = lambda u: io.BytesIO(urllib.request.urlopen(u, timeout=120).read())

os.makedirs('data', exist_ok=True)
k = pd.concat([pd.read_csv(get(HF.format('train'))), pd.read_csv(get(HF.format('validation')))])
k['Id'] = k['Id'].astype(int); k['essay_set'] = k['essay_set'].astype(int)
dev1 = set(pd.read_csv(get(DEV1)).Id)
samples = {'set1': k.query('essay_set == 1 and Id not in @dev1').sample(50, random_state=2026),
           'set10': k.query('essay_set == 10').sample(30, random_state=2026)}
for name, df in samples.items():
    df[['Id', 'Score1', 'Score2']].to_csv(f'data/labels_{name}.csv', index=False)
    with open(f'data/blind_{name}.txt', 'w') as f:
        for _, r in df.iterrows(): f.write(f"### {r.Id}\n{str(r.essay_text).strip()}\n\n")
print('wrote data/')
