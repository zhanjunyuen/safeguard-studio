# Marking-model training data

Builds the training data for the Safeguard Studio marker (handoff §7 steps 5–6). Claude writes the pupil answers and the marks in-session, in batches saved under `data/`. Scripts tie every row to exact simulator facts and validate it.

## Pipeline

| Step | Command | Output |
|---|---|---|
| 1. Contexts from the simulator | `npx vite-node scripts/marking-data/contexts.ts` | `data/contexts.jsonl` (1,337 contexts, both levels) |
| 2. Claude writes items | by hand, in `data/items/b*.jsonl` | pupil text + concept quotes + reasoning + feedback |
| 3. Second-model pupil texts | `python3 second-model-prep.py`, run `data/second/input.jsonl` on `deepseek-v4-flash`, Claude marks them in `data/second/marks.jsonl`, `python3 merge-second.py` | `data/items/s01-second-model.jsonl` |
| 4. Robustness variants | `python3 robust.py` | `data/items/r01-robust.jsonl` |
| 4b. Gold marks on generated answers | `scale/gen-prep.py` → hosted models write answers; `scale/gold.py select` / `select2`, Claude marks in `data/scale/gold/marks*/` and writes feedback in `feedback*/`, `gold.py convert` (`GOLD_SET=2` for g02) | `data/items/g01-gold.jsonl`, `g02-gold.jsonl` |
| 5. Follow-ups | by hand, in `data/followups/f*.jsonl` (`scale/followup_prep.py` picks items) | pupil question + answer about a marked item |
| 5b. Skills summaries | `scale/summary_prep.py select`, Claude writes the text, in `data/summaries/s*.jsonl` | one pupil's four marks → score /8, band, strengths, next steps, summary |
| 6. Build and validate | `npx vite-node scripts/marking-data/build.ts` | `data/rows/{train,test}.jsonl`, `report.json` |
| 7. Blind judge | `judge.ts prep`, run `data/judge/input.jsonl` on `qwen3.5-397b`, `judge.ts compare`; for gold, `scale/judge-gold.ts prep/compare` (`GOLD_SET=2`) | agreement report, `hard-cases.jsonl`, `data/scale/judge-gold*/disagreements.jsonl` |
| 8. Export for Adaption | `python3 export.py` | `data/adaption/{train,test}.jsonl`, `summary.json` |

Hosted models are run with the `adaption_batch_responses` tool of the `delegate` MCP server, which holds the Adaption key.

## What the validator rejects

- a quote that is not in the pupil's answer
- a missing verdict or reason for a concept, or a concept from another criterion
- a computed concept (A1) given by hand: it always comes from the simulator
- a stated level that disagrees with `levelFor`
- a follow-up whose answer claims a different level, whose question quotes a different level ("Why 0?" on a Level 1 item), or that cites a concept not in the mark
- a skills summary whose text claims a different total out of 8 or a different band

## Keys

Rows and references use file-scoped keys: `ctx#<file stem>.<n>` (e.g. `T:quiz@2:bare#g01.3`), where `n` counts that context within one item file. Adding or renaming another item file never changes an existing key. Until 18 Nov keys were counted across all files, so new files sorting before `s01` renumbered its items and re-pointed 11 follow-ups at the wrong answers; `scale/migrate_keys.py` moved every reference, checked by pupil text.

## Row kinds

- **marking**: one answer → the mark JSON (concepts with quotes, level, feedback, next step).
- **robustness**: the same marks under injection, keyword stuffing and text-speak.
- **followup**: a pupil's question about their feedback and Claude's answer, tied to the mark.
- **summary**: four marks (one per skill) → `skillsSummary` with `scores`, `total` /8, `band` (0–2 Getting started, 3–5 Developing, 6–8 Secure, from `skillsScore` in `src/engine/marking.ts`), `strengths`, `nextSteps` and a short summary in Claude's words.

## Held out

The whole `coding`, `firstaid` and `gamemod` challenges (both levels), and the 5 scenarios marked `holdOut` in `transfer-scenarios.json`, go to `test` only.

## Limits

- **Marking and pupil text are written in the same session.** The handoff asked for a separate, blind Claude call to mark each answer. Instead, the blind check is a different model family (`qwen3.5-397b`), and rows where it disagrees are left out.
- **Robustness rows** (injection, keyword stuffing, text-speak) are generated from Claude's items and reuse their marks. They were about 30% of rows at run 1 (to reach the 1,000-row minimum); in v3 they are 11%, close to the ~10% the handoff planned.
- **Reasoning traces are inside the completion.** Adaption's raw upload keeps only `original_prompt` / `original_completion` (checked 19 Nov by uploading a mapped `reasoning_trace` column and downloading it: dropped), so runs 1–3 trained without traces. From v3.1, `export.py` puts the trace first in the completion: `{"reasoning": ..., <mark>}` for marks and summaries, `{"reasoning": ..., "answer": ...}` for follow-ups. The app's model provider must parse this and never show `reasoning` to pupils. Gold reasons are written from the simulator facts (risk, build, failing tests, replay, anchors), not generic labels.
- **48 unjudged rows.** They timed out at the judge again and again, so they were skipped (28 training rows, 19 test rows, 1 outside the build). They are kept, unchecked.
- **Author skew.** Claude-written answers are 52% Level 2; generated answers are 17% Level 2 (g02 raised this from 13%). A model could learn "polished = high". Report held-out accuracy by author to check.
- **Scale.** v3 has 3,227 training rows after hard cases are dropped (2,124 marking, 349 robustness, 554 follow-up, 200 summary), not the planned ~20,000. It was 1,065 at run 1. That is enough for `openai/gpt-oss-120b`, not for `Qwen/Qwen3.5-122B-A10B` (10,000 minimum).
