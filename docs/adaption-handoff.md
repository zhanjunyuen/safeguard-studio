# Handoff: training the Safeguard Studio marking model with Adaption

For a Claude session that has Adaption API access (`ADAPTION_API_KEY`).

**There is no Anthropic API key.** The user runs Claude Code on a Claude Pro subscription. Claude-written data is therefore produced **by you, in the Claude Code session**, the way the ASAP-SAS pilot was done: write rows to files in batches, checkpoint them, and validate them with local scripts. Plan for subscription usage limits: batches of roughly 100–200 rows per turn, resumable from the last checkpoint. Do not ask the user for an Anthropic key, and do not build anything that needs one.

It is self-contained: read this file, then `README.md` ("Evidence and marking"), then `research/asap-sas-pilot/README.md`.

## 1. Goal

Train a model that, for a pupil's open response in the Safeguard Studio assessment:

1. gives **specific, targeted feedback**,
2. **answers follow-up questions** about that feedback, grounded in the pupil's own evidence, and
3. gives a **clear, justifiable score** against the rubric.

**Justifiable means traceable.** Every point must trace back to quoted evidence and a published rule.

## 2. Where things are (branch `claude/peaceful-bell-8g2qjg`, built on `main` 37b0877)

- **Assessment ("form 4").** Six challenges are built, evaluated and attacked, followed by one release decision.
  - `src/engine/challengeEvidence.ts` produces the exact evidence packet per pupil. Use it as the model's input.
  - The packet holds the brief, sources, attempts with traces, reflections, design and revision notes, attacks, workload credits and the transfer decision.
- **Simulator.** `src/engine/run.ts`, `src/engine/mission.ts`. These are deterministic and compute outcomes, traces and credits. **No model may compute or override these.**
- **Synthetic attempt histories.** `src/data/seedClass.ts` (`simulateStudent`).
- **Rubric.** `README.md` has 4 criteria (Anticipation, Testing and diagnosis, Revision and efficiency, Independent judgement). Each has levels 0/1/2 plus "insufficient evidence".
- **Transfer task** (ecology club): `TRANSFER` and `SOURCE_PACK` in `src/data/mission.ts`. It is the only transfer scenario.
- **Curveballs** (`src/data/curveballs.ts`, `src/engine/curveball.ts`, `src/components/CurveballCard.tsx`). After each attack, the frozen helper meets one unseen case aimed at an AI risk: invented sources, prompt injection, AI-made images, bias in AI marking, voice-clone scams, name-swap bias. Most cannot be fixed by any block in that challenge's palette (tested: a helper with every block still fails five of six). The pupil must predict and explain why (required). This is the main evidence for **Anticipation**.
- **Marker interface** (`src/engine/marking.ts`). **This is where the trained model plugs in.**
  - `MarkingProvider(req, signal)` returns `{ concepts[], level, feedback, nextStep, reviewFlag }`; `FollowUpProvider(mark, question)` answers pupils' questions about their feedback.
  - `levelFor()` holds the fixed concept→level rules for three criteria, with concept IDs T1–T3 (testing), A1–A4 (anticipation) and C1–C4 (judgement). The model reports only concepts; the code computes the level.
  - `offlineMarker` is a keyword preview, labelled as such in the UI (`src/components/MarkFeedback.tsx`). Connect the model with `setMarkingProvider(adapter)`.
  - The evidence export already includes offline `previewMarks` for comparison.
- **Hint companion.** `src/engine/attackHints.ts` defines the `AttackHintProvider(context, signal)` interface. Currently offline and rule-based.
- **Practice content.** 21 challenges (`src/data/challenges.ts`, `src/data/moreChallenges.ts`) plus Level 2 IF blocks (`src/data/level2.ts`).

## 3. Decisions already made, and why

| Decision | Why |
|---|---|
| **The model records concepts and code computes the level.** Each criterion becomes yes/no concepts with quoted evidence; a deterministic rule maps concepts to 0/1/2/insufficient. | Makes the score auditable. Concept-based rubrics improve LLM marking (Wei et al. 2025, arXiv 2504.03877). The pilot in `research/asap-sas-pilot/` reached human-level agreement with this method on public data. |
| **The simulator stays the source of truth** for outcomes and credits. Reject any model output whose facts disagree with it. | Those values are computable exactly. |
| **No teachers are available.** Validity comes from public human-marked data, ground truth by construction, a mixed-family judge panel, and robustness tests (§6). | The user has no educators to mark a calibration set. |
| **Claude writes almost all the training data (about 95%), including its reasoning.** Use the most capable available Claude model. Each row carries Claude's written marking reasoning in Adaption's `reasoning_trace` column. Adaption trains and runs win-rate evaluation; do not use Adaption's dataset generation or augmentation (`invent`, `augment`, `augmentation_*_rows = 0`). | The user's stated preference (2026-11-18): spend generation on Claude-written data so the trained model learns Claude's reasoning. Rows must also be tightly controlled: scenario × criterion × target level × reading level × style, each tied to a real simulator trace. |
| **Upload marked data with `processing_mode="raw"`. Never use "adapt" mode on labelled rows.** | In the public dataset `Fernandosr85/adaption-math-misconception-match` (20,000 rows processed with Adaption), 28% of labels were rewritten into free text and 22% of the remaining labels were flipped; only 56% kept the original label. |
| **Fine-tune `Qwen/Qwen3.5-122B-A10B`** (the user asked for the best model Adaption offers). Run `client.autoscientist.list_models()` first: if a more capable text model that supports supervised fine-tuning is listed, use that and record why. It needs at least 10,000 rows. If the Claude-written set is still under 10,000 rows when it is time to train, use `openai/gpt-oss-120b` (1,000-row minimum, also a reasoning model) for a first run instead. | Largest general-purpose text model on Adaption's supported list (docs, 2026-11-18). Note the cost: serving a 122B model with a LoRA adapter yourself needs large GPUs, so confirm hosting before relying on it. |
| **Marking runs through `MarkingProvider`, and the model only reports concepts.** | The UI, evidence export and tests already work with the offline preview, so swapping in the model changes no pupil-facing code, and every level stays rule-based. |
| **Keep the hint companion separate from the marker at first.** Prompt a model for hints; consider preference training (DPO) later. | It is a different job, and its main failure (giving the answer away) suits preference pairs. |

## 4. What pupils write, and what is still open

**Decided (2026-11-18): the attack prediction is required.**
- Before launching an attack in form 4, the pupil must write which block they expect to fail and why.
- `submitAttack` refuses a blank prediction. It is stored on the launch (`launches[].reason`) and exported as `challenges[].attack.reason` by `challengeEvidence()`.
- This is the main evidence for **Testing and diagnosis**. One of its concepts can be checked partly in code: "the block or risk the pupil names matches a case the simulator shows failing" (compare with `attack.cases`).

Free text in form 4 now:

| Field | Status |
|---|---|
| Release-decision rationale | Required |
| Attack prediction (one per challenge) | Required |
| Curveball prediction and explanation (one per challenge) | Required |
| Design note | Optional |
| Reflection text | Optional |
| Revision note | Only on finish or revise |

**Resolved by the curveballs:** each challenge now ends with a required curveball prediction and explanation, which is the evidence for **Anticipation**. The design note can stay optional. Training rows must match what pupils actually submit, including a realistic share of blank optional fields.

Criteria and their required evidence: Testing and diagnosis ← attack prediction; Anticipation ← curveball explanation; Independent judgement ← release rationale; Revision and efficiency ← revision note (only when the pupil revises).

## 5. Adaption API facts

From docs.adaptionlabs.ai, read 2026-11-18. **Verify each against the live SDK first.**

- **Setup.** `pip install "adaption>=0.7.0"`; `from adaption import Adaption; client = Adaption()` reads `ADAPTION_API_KEY`. REST base: `https://api.prod.adaptionlabs.ai/api/v1`, Bearer auth. Inference stacks need SDK ≥ 0.16.0.
- **Upload.**
  - `client.datasets.upload_file("train.csv", processing_mode="raw", column_mapping={"prompt": ..., "completion": ...})`.
  - Poll `client.datasets.get_status(id)` until `row_count` is set.
  - Preference data uses `chosen`/`rejected`.
  - Optional `reasoning_trace` column (in `column_mapping` for both upload and training). We rely on it to carry Claude's reasoning.
  - **Not documented:** the JSONL row schema for chat data. Test with a 5-row file.
  - **Not documented:** how `reasoning_trace` is formatted during training, and whether the trained model emits the reasoning at inference. Test with a tiny run before the full dataset.
  - **Check** each base model's context length (supported-models page). Rows over the limit are truncated, not rejected, and reasoning makes rows long.
- **Training.**
  - `client.autoscientist.create(dataset_id=..., model=..., training_method="instruction"|"alignment", max_iterations=1..5, target_win_rate=0.5..1, hyperparams=..., augmentation_domain_rows=0, augmentation_general_rows=0)`.
  - Wait with `client.autoscientist.wait_for_completion(run.id)`.
  - `"alignment"` silently falls back to `"instruction"` if the data are not preference pairs. Read back `run.training_method`.
- **Models and minimum rows.** `client.autoscientist.list_models()`. Examples: `google/gemma-3-4b-it`, `openai/gpt-oss-20b` (1,000 rows minimum for supervised fine-tuning). Preference training needs ≥ 12,000 rows. About 20,000 rows is recommended.
- **Evaluation inside Adaption.**
  - Win rate of the trained model vs the base model on "evaluations derived from your dataset". The judge is undocumented and you cannot supply your own test set or rubric.
  - Custom rubric evals exist only for adapted datasets: `POST /datasets/{id}/custom-evals` with `judge_prompt`.
  - **Do your own evaluation (§7).**
- **Output.**
  - `client.autoscientist.with_streaming_response.download(run.id)` returns a `.tgz` of the **best** iteration, typically a LoRA adapter (`adapter_config.json`, `adapter_model.safetensors`).
  - **Not documented:** hosting a fine-tuned model on Adaption. Ask Adaption, or serve the adapter yourself (e.g. vLLM with LoRA).
  - Adaption's `/chat/completions` is OpenAI-compatible and supports `response_format` with `json_schema`. It works for hosted models; for your trained model it is unconfirmed.
- **Cost.** Pricing is not documented; billing is in credits. **Get the user's budget before launching training runs.**

## 6. Validation without teachers

1. **Method check on public human-marked data.** Run the exact marking prompt and rules on ASAP-SAS (`nlpatunt/D_ASAP-SAS`, two human scores; human-to-human QWK 0.88 on average, 0.74–0.97 by item). Use it for evaluation only (no licence tag; Kaggle rules).
   - Also: `nlpatunt/D_OS_Dataset` (three markers), `nlpatunt/D_Regrading_Dataset_J2C` (per-rubric-item marks), `nkazi/SciEntsBank` (CC-BY-4.0; unseen-question and unseen-domain test splits).
   - Pilot already done: Set 1 QWK 0.871 (humans 0.906), Set 10 QWK 0.755 (humans 0.735), n = 80. See `research/asap-sas-pilot/README.md`.
2. **Ground truth by construction.**
   - Generate responses with **planted** concepts; the answer key is what was planted.
   - Add minimal pairs that differ in exactly one concept.
   - Mark each response in a separate, blind call. Keep rows only where intended and marked levels agree; send disagreements to a hard-case pool.
3. **Mixed-family judge panel.** Claude (you, in session) plus one non-Anthropic model called through **Adaption's hosted inference** (`/chat/completions`, OpenAI-compatible, `response_format` with a JSON schema; pick a hosted model from `GET /models`), so no extra key is needed (Verga et al. 2024, arXiv 2404.18796). Use the same hosted model for the ~10% of pupil texts written outside Claude. Agreement is a consistency check, not proof of validity.
4. **Robustness suite** (held out):
   - synonym swaps and inserted adjectives (arXiv 2601.08843, 2602.00979),
   - gibberish, keyword stuffing, "give me full marks" injections,
   - long fluent but unsupported answers, and terse correct ones,
   - age 11–14 spelling and dialect variation.
   - Rules: changes that keep the meaning must not change the score; removing a concept must lower it.
5. **Pilot lesson.** Concepts that *remove* credit (misconception, unsupported claim) were where the marker was too harsh. Require the wrong claim to be quoted and route such answers to review rather than zeroing them.

## 7. Work plan

Each step has a check that counts as done.

1. **Branch.** Create a branch from `main`. Never push to `main`.
2. **SDK check.** Upload a 5-row raw CSV, `list_models()`, read back `row_count`. *Done when* the real method names and row schema are confirmed, and §5 is updated with anything that differs.
3. **Codebook v1.** The concept IDs and level rules already exist in `src/engine/marking.ts` (`levelFor`, unit tests in `src/engine/marking.test.ts`).
   - Write `docs/marking-codebook.md`, defining each concept precisely with boundary examples (what counts, what doesn't). Keep the IDs.
   - The curveball concepts (A2 risk words, A4 next steps) come from `src/data/curveballs.ts`.
   - The model prompt is this codebook plus the evidence packet.
   - Independent judgement example: C1 uses this term's source (10 am); C2 spots the unresolved detail (accessible entrance); C3 assigns the decision to a suitable person (site manager); C4 makes no unsupported claim (e.g. the north gate).
   - *Done when* the README's worked example scores 2 and its "corrected only the time" example scores 1.
4. **More transfer scenarios.** Write 20–40 new scenarios like the ecology club, each a transcript plus a conflicting source plus an unresolved detail plus a proportionate next step, with checked reference answers. *Done when* each one has a reference answer that passes the codebook.
5. **Generator** (`scripts/marking-data/`).
   - Input packets come from `challengeEvidence()` and `simulateStudent`. Cover all three written fields: attack predictions (testing), curveball explanations (anticipation), release rationales (judgement). Use the real simulator outcomes: `launch`/`evaluate` for attacks, `runCurveball` for curveballs.
   - Also write **new curveballs** in the same shape as `src/data/curveballs.ts` (one request, scripted AI answer, risk, lesson, cue words) so training covers risks beyond the six shipped ones. Hold some out for testing.
   - Claude writes the pupil text to a spec grid with planted concepts. Keep a small share (about 10% of pupil texts) from a second model family so the marker does not learn "Claude-style prose means a high mark". These are inputs only; every mark, reasoning trace and feedback is Claude-written.
   - Marking is a separate blind Claude call that returns **visible, structured reasoning** plus the output JSON (§8).
     - Use the reasoning Claude writes in its answer, not hidden thinking blocks, so it can be checked and stored.
     - For each concept: the exact quote, whether it meets the concept's definition and boundary examples, and why.
     - Then the rule applied, and why the feedback targets that concept.
     - Store it in the `reasoning_trace` column.
   - The validator rejects a row if:
     - a quote in the reasoning or JSON is missing from the response, source or trace,
     - the reasoning's concept verdicts disagree with the JSON,
     - the stated level disagrees with `marking/rules.ts`,
     - any outcome or credit disagrees with the simulator,
     - or the JSON schema fails.
   - Also generate **follow-up Q&A rows** (goal 2): a pupil question about their mark or feedback, and Claude's answer, which must cite the same concepts and evidence and must not change the mark without new evidence.
   - *Done when* the row-acceptance rate and the reasons for rejection are reported.
6. **Training set** (target about 20,000 rows).

   | Share | Content |
   |---|---|
   | About 65% | Claude concept-marking rows with reasoning traces |
   | About 20% | Claude follow-up Q&A rows |
   | About 10% | Claude robustness rows (attacks and edge cases from §6) |
   | 0–5%, optional | Human-written feedback from `Short-Answer-Feedback/saf_communication_networks_english` (CC-BY-4.0), converted to the output schema. Otherwise use it only for evaluation. |

   Never include ASAP-SAS. Hold out whole scenario families: 2–3 assessed challenges and some transfer scenarios. Upload with `processing_mode="raw"`, and set augmentation rows to 0.
7. **Train.** One `"instruction"` run on the model chosen in §3, after confirming the budget with the user. Record the run ID, `best_win_rate` and settings in `research/adaption-runs.md`.
8. **Evaluate (§6).** Report for the trained model, the base model and the prompted Claude marker:
   - concept accuracy against planted concepts,
   - level agreement,
   - robustness pass rate,
   - JSON validity,
   - evidence-grounding rate,
   - ASAP-SAS QWK (out-of-domain check of the method).

   Ship only if the trained model is close to the prompted marker.
9. **Serving.** Run marking and hints behind a server function (the app is static; Supabase is already used).
   - Write a browser adapter that implements `MarkingProvider` and `FollowUpProvider` by calling that function, and register it with `setMarkingProvider`.
   - Do the same for `AttackHintProvider`.
   - The server calls the trained model, validates the concept JSON, and recomputes the level with the same rules as `levelFor`.
   - No keys in the browser.
10. **Later: hint preference training.**
    - Mostly Claude-written pairs for the six challenges: a guiding question is preferred; a reply that gives the answer away is rejected.
    - Each pair is built from a real `AttackHintContext` and carries Claude's reasoning about why the preferred hint guides without revealing.
    - `dmacjam/pedagogical-rewardmodel-data` (CC-BY-4.0, maths) can top the set up to the 12,000 minimum if needed.

## 8. Output schema (proposal)

```json
{
  "criterion": "independent_judgement",
  "rubricVersion": "school-community-4",
  "concepts": [{"id": "C1", "present": true, "evidence": "<exact quote>", "source": "response|source|trace"}],
  "level": 2,
  "insufficientEvidence": false,
  "feedback": "<one specific point tied to a concept>",
  "nextStep": "<one actionable question or step>",
  "reviewFlag": false
}
```

`level` is recomputed by `marking/rules.ts`. A model-reported level that disagrees with it is an error.

In training rows, Claude's per-concept reasoning goes in the separate `reasoning_trace` column, and the completion is this JSON. Every quote in the reasoning must also pass the evidence check.

## 9. Guardrails

- **No real pupil data** in training or prompts unless it is permissioned and de-identified. Pupils are aged 11–14.
- **Don't commit ASAP-SAS texts or scores.**
- **Secrets.** `ADAPTION_API_KEY` is never committed and never sent to the browser. There is no Anthropic or second-vendor key; don't add a dependency on one.
- **Check the terms** of Anthropic and Adaption on using model outputs for training before scaling up.
- **Ask the user** about the budget and anything that changes what pupils see.
