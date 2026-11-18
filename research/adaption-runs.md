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
| Status | running (started 17:45 UTC) |
| `best_win_rate` | pending |

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
