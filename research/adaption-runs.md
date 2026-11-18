# Adaption training runs

Training log for the marking model (handoff §7 step 7). The set is built by `scripts/marking-data/` (see its README).

## Run 1 · 18 Nov 2026

| | |
|---|---|
| Run ID | `209047c0-dd6b-42e1-a5d5-050813eaa245` |
| Dataset | `309cc67c-b31c-4d37-b385-75a2a304b18d` (`safeguard-marker-train-v1`, 1,065 rows, raw mode) |
| Base model | `openai/gpt-oss-120b` |
| Method | `instruction` (confirmed in the response), `max_iterations` 1, `target_win_rate` 0.8 (default) |
| Augmentation | 0 domain rows, 0 general rows |
| Columns | prompt `original_prompt`, completion `original_completion`, no reasoning trace |
| Hyperparameters | Adaption's recommendation: LoRA r 4, alpha 8, q/v projections, 1 epoch, lr 5e-5 cosine, `train_on_inputs` false |
| Status | succeeded: started 17:45, finished 18:31 UTC (1 iteration, 27 steps) |
| `best_win_rate` | **0.4293** (target 0.8; Adaption only accepts targets of 0.5 or more) |
| Adapter | LoRA for `togethercomputer/gpt-oss-120b-bf16`, 6 MB of weights. Kept outside the repo at `~/adaption-adapters/safeguard-marker-run1/` (zstd-compressed tar, even though the extension is `.tgz`) |

**Why this model:** the set is about 1,000 rows, below the 10,000-row minimum for `Qwen/Qwen3.5-122B-A10B` (handoff §3). This first run is kept to one iteration because the credit cost was unknown.

### Training set

- **Rows:** train 1,065 (marking 521, robustness 349, follow-up 195); test 84 (held out, never uploaded).
- **By criterion (train):** testing 272, anticipation 348, judgement 186, revision 259.
- **By level (train):** 0: 138, 1: 368, 2: 545; 14 rows have no level (follow-ups).
- **Validator:** 0 rejects in the final build. Earlier builds rejected a follow-up phrasing ("for level 2…") and one mistyped item key; both were fixed before this build.
- **Blind judge** (`qwen3.5-397b`, a different model family): 957 rows judged.
  - Level agreement 94.6%, concept agreement 95.8%. Anticipation is the weakest (A2–A4 about 93–94%).
  - The 53 rows where the judge gave a different level are left out of training, along with their follow-ups: 60 training rows in all.
  - 48 rows timed out repeatedly at the gateway (504) and were not judged: 28 training rows and 19 test rows, plus one row that ran outside the build. They are kept as unchecked.
- **Mark fixes found during review:** three revision items in batch b12 credited R2 for a test result that contradicts the simulator. The codebook says such a claim does not count, so they were corrected before upload.

### Things learnt about the API

- A raw upload stores the columns as `original_prompt` / `original_completion` (plus empty `enhanced_*` columns). Training must name those columns; `prompt` / `completion` are rejected with a 400 error.
- The column mapping for raw uploads has no `reasoning_trace` key, so a reasoning-trace column is dropped silently. That's why this run trains on the JSON completion alone. To train with reasoning, the dataset would need a different route, for example asking Adaption whether raw ingestion can keep extra columns.
- The stored rows were downloaded and checked: all 1,065 prompts and completions match the export byte for byte, and the `enhanced_*` columns are empty. Nothing was rewritten.

### Results

**Training loss** (from `trainer_state.json`):

| | Start | End |
|---|---|---|
| Training loss | 2.42 | 1.13 |
| Eval loss | 1.88 (step 7) | 1.31 (step 27) |

Eval loss was still falling at the last step, so the run looks under-trained. That's not surprising: it ran 1 epoch at LoRA rank 4, only on the q/v projections.

**Adaption win rate: 0.43.** This is below 0.5, so by Adaption's own comparison the tuned model did not come out ahead more often than not. Do not treat run 1 as a usable marker.

**Held-out evaluation (handoff §8): not possible from here.**
- Adaption serves only its general hosted models through the API (`models.list` accepts only `type="hosted"`), so the adapter cannot be called.
- A 120B base model cannot run on this machine.
- What we do have is the bar a served adapter must clear. The blind zero-shot judge (`qwen3.5-397b`) agrees with the reference level on **62 of 63** judged held-out test rows (98.4%), and on 94.6% of all judged rows. A strong general model with the codebook in its prompt is already a good marker.

### Next steps (proposed)

1. **Ship the zero-shot marker first.** The app's AI marking path could use a hosted model, such as `qwen3.5-397b`, with the codebook prompt from `build.ts`. `levelFor` computes the level and the quotes are checked against the pupil's text, as now. That works today; an adapter needs separate hosting.
2. **If we train again:** use 2–3 epochs or `max_iterations` 3, find a way to keep the reasoning traces, and add more Claude-written items, especially anticipation, where agreement is lowest. Ask for the credit budget first.
3. To use any adapter, it has to be served somewhere that can host LoRA on gpt-oss-120b (handoff §7 step 9).
