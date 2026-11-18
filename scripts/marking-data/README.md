# Marking-model training data

Builds the training data for the Safeguard Studio marker (handoff §7 steps 5–6). Claude writes the pupil answers and the marks in-session, in batches saved under `data/`. Scripts tie every row to exact simulator facts and validate it.

## Pipeline

| Step | Command | Output |
|---|---|---|
| 1. Contexts from the simulator | `npx vite-node scripts/marking-data/contexts.ts` | `data/contexts.jsonl` (1,337 contexts, both levels) |
| 2. Claude writes items | by hand, in `data/items/b*.jsonl` | pupil text + concept quotes + reasoning + feedback |
| 3. Second-model pupil texts | `python3 second-model-prep.py`, run `data/second/input.jsonl` on `deepseek-v4-flash`, Claude marks them in `data/second/marks.jsonl`, `python3 merge-second.py` | `data/items/s01-second-model.jsonl` |
| 4. Robustness variants | `python3 robust.py` | `data/items/r01-robust.jsonl` |
| 5. Follow-ups | by hand, in `data/followups/f*.jsonl` | pupil question + answer about a marked item |
| 6. Build and validate | `npx vite-node scripts/marking-data/build.ts` | `data/rows/{train,test}.jsonl`, `report.json` |
| 7. Blind judge | `judge.ts prep`, run `data/judge/input.jsonl` on `qwen3.5-397b`, `judge.ts compare` | agreement report, `hard-cases.jsonl` |
| 8. Export for Adaption | `python3 export.py` | `data/adaption/{train,test}.jsonl`, `summary.json` |

Hosted models are run with the `adaption_batch_responses` tool of the `delegate` MCP server, which holds the Adaption key.

## What the validator rejects

- a quote that is not in the pupil's answer
- a missing verdict or reason for a concept, or a concept from another criterion
- a computed concept (A1) given by hand: it always comes from the simulator
- a stated level that disagrees with `levelFor`
- a follow-up that claims a different level, or cites a concept not in the mark

## Held out

The whole `coding`, `firstaid` and `gamemod` challenges (both levels), and the 5 scenarios marked `holdOut` in `transfer-scenarios.json`, go to `test` only.

## Limits

- **Marking and pupil text are written in the same session.** The handoff asked for a separate, blind Claude call to mark each answer. Instead, the blind check is a different model family (`qwen3.5-397b`), and rows where it disagrees are left out.
- **Robustness rows** (injection, keyword stuffing, text-speak) are generated from Claude's items and reuse their marks. They make up about 30% of rows, more than the ~10% the handoff planned. This was done to reach the 1,000-row minimum.
- **Scale.** The set is about 1,000 training rows, not the planned ~20,000. That is enough for `openai/gpt-oss-120b`, not for `Qwen/Qwen3.5-122B-A10B` (10,000 minimum).
