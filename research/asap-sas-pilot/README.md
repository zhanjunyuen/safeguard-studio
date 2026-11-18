# ASAP-SAS pilot: does "record concepts, then score by rule" match human markers?

A small blind check of the marking method planned for Safeguard Studio. The marker records **codes**, meaning what an answer contains, and fixed rules turn the codes into a score. It was run on public, human-scored school science answers because no teacher-marked Safeguard Studio responses exist yet.

## Setup

- **Data:** [ASAP-SAS](https://www.kaggle.com/c/asap-sas) via the Hugging Face mirror `nlpatunt/D_ASAP-SAS`. Each answer has two independent human scores (`Score1`, `Score2`).
  - Set 1 "Acid Rain" (grade 10, 0–3): 50 random answers, excluding the 300 answers the codebook was written from.
  - Set 10 "Doghouse" (grade 8, 0–2): 30 random answers. Development IDs are not published for this set, so about 18% may overlap them.
- **Codebooks and rules:** from [jgf1123/asap_sas_scoring](https://github.com/jgf1123/asap_sas_scoring) (code MIT, documents CC BY 4.0): Set 1 codebook v0.2, Set 10 codebook v1.2.
  - `score_rules.py` re-implements their `score_from_codes.py` from the codebook text.
  - Set 10 uses their pre-registered configuration (variant *b* of every boundary rule). Variant *a* is shown for comparison.
- **Marker:** Claude, coding in a chat session from the codebook only.
  - Codes were written to `codes_set*.csv` and converted to scores before the label file was opened.
  - Single run, no prompt tuning.

## Results

| Item | n | Marker vs Score1 (QWK, 95% bootstrap CI) | Marker vs Score2 | Human vs human, same answers | Exact: marker / humans | Mean score: marker / Score1 |
|---|---|---|---|---|---|---|
| Set 1 | 50 | **0.871** [0.75, 0.95] | 0.921 | 0.906 | 0.82 / 0.82 | 1.24 / 1.36 |
| Set 10 (config b) | 30 | **0.755** [0.58, 0.89] | 0.658 | 0.735 | 0.77 / 0.73 | 1.13 / 1.30 |

QWK is quadratic weighted kappa (1 = perfect agreement, 0 = chance).

- **Agreement:** on both items the marker agreed with the official score about as well as the second human rater did on the same answers.
- **Large errors:** one answer in 80 was two or more points off.
- **Context:** the codebook's author found the same order of results on 546 and 557 held-out answers (Set 10 QWK 0.763 vs human 0.884; Set 1 0.895 vs 0.944).

## Where the marker went wrong

- **Too strict on "misunderstanding" codes (Set 10).** Three of the 7 disagreements were answers the marker zeroed for a misconception that both humans let pass with 1 point (26829, 26670, 27393). The marker scored lower overall (mean 1.13 vs 1.30).
- **Literal reading of "places the chosen colour against another" (27583).** A general trend statement was not credited; both humans gave full marks.
- **Set 1 errors** are mostly borderline readings of whether an item was *identified as missing*.

Two lessons for the Safeguard Studio rubric:
1. Codes that **remove** credit (misconceptions, unsupported claims) need the exact wrong claim quoted, and should send the answer to review rather than zeroing it.
2. Every concept needs boundary examples.

## Limits

- **Small sample.** n = 80 and the confidence intervals are wide.
- **Domain.** These are science items, not AI-literacy responses, so this supports the *method*, not marks on Safeguard Studio tasks.
- **Single in-session run.** Not a pinned API prompt, and not a fine-tuned model.
- **Same model family.** The marker belongs to the same model family as the codebook author's study.

## Reproduce

```bash
cd research/asap-sas-pilot
pip install pandas numpy
python fetch_and_sample.py   # downloads data, rebuilds the identical blind sample into data/ (git-ignored)
python evaluate.py           # QWK, CIs and disagreement lists from the committed codes
```

ASAP-SAS texts and scores are not committed (Kaggle competition rules). Only IDs, codes and predictions are.
