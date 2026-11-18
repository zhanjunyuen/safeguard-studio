# Handoff: training the Safeguard Studio marking model with Adaption

For a Claude session that has Adaption API access (`ADAPTION_API_KEY`). It is self-contained: read this file, then `README.md` ("Evidence and marking"), then `research/asap-sas-pilot/README.md`.

## 1. Goal

Train a model that, for a pupil's open response in the Safeguard Studio assessment:

1. gives **specific, targeted feedback**,
2. **answers follow-up questions** about that feedback, grounded in the pupil's own evidence, and
3. gives a **clear, justifiable score** against the rubric.

**Justifiable means traceable.** Every point must trace back to quoted evidence and a published rule.

## 2. Where things are (repo state at `main` 37b0877)

- **Assessment ("form 4").** Six challenges are built, evaluated and attacked, followed by one release decision.
  - `src/engine/challengeEvidence.ts` produces the exact evidence packet per pupil. Use it as the model's input.
  - The packet holds the brief, sources, attempts with traces, reflections, design and revision notes, attacks, workload credits and the transfer decision.
- **Simulator.** `src/engine/run.ts`, `src/engine/mission.ts`. These are deterministic and compute outcomes, traces and credits. **No model may compute or override these.**
- **Synthetic attempt histories.** `src/data/seedClass.ts` (`simulateStudent`).
- **Rubric.** `README.md` has 4 criteria (Anticipation, Testing and diagnosis, Revision and efficiency, Independent judgement). Each has levels 0/1/2 plus "insufficient evidence".
- **Transfer task** (ecology club): `TRANSFER` and `SOURCE_PACK` in `src/data/mission.ts`. It is the only transfer scenario.
- **Hint companion.** `src/engine/attackHints.ts` defines the `AttackHintProvider(context, signal)` interface. Currently offline and rule-based.
- **Practice content.** 21 challenges (`src/data/challenges.ts`, `src/data/moreChallenges.ts`) plus Level 2 IF blocks (`src/data/level2.ts`).

## 3. Decisions already made, and why

| Decision | Why |
|---|---|
| **The model records concepts and code computes the level.** Each criterion becomes yes/no concepts with quoted evidence; a deterministic rule maps concepts to 0/1/2/insufficient. | Makes the score auditable. Concept-based rubrics improve LLM marking (Wei et al. 2025, arXiv 2504.03877). The pilot in `research/asap-sas-pilot/` reached human-level agreement with this method on public data. |
| **The simulator stays the source of truth** for outcomes and credits. Reject any model output whose facts disagree with it. | Those values are computable exactly. |
| **No teachers are available.** Validity comes from public human-marked data, ground truth by construction, a mixed-family judge panel, and robustness tests (§6). | The user has no educators to mark a calibration set. |
| **Opus-class Claude writes and marks the synthetic data; Adaption trains and runs win-rate evaluation.** Adaption's dataset generation (`invent`) is at most a source of extra variety. | Rows must be tightly controlled: scenario × criterion × target level × reading level × style, each tied to a real simulator trace. |
| **Upload marked data with `processing_mode="raw"`. Never use "adapt" mode on labelled rows.** | In the public dataset `Fernandosr85/adaption-math-misconception-match` (20,000 rows processed with Adaption), 28% of labels were rewritten into free text and 22% of the remaining labels were flipped; only 56% kept the original label. |
| **Keep the hint companion separate from the marker at first.** Prompt a model for hints; consider preference training (DPO) later. | It is a different job, and its main failure (giving the answer away) suits preference pairs. |

## 4. Open decision for the user (ask before generating data)

In form 4 only the **release-decision rationale** is required free text:
- the design note is optional,
- reflection text is optional,
- the attack step has **no** free text,
- revision notes appear only on finish or revise.

So Anticipation and Testing and diagnosis have little to mark, and a model trained on real inputs would mostly learn "insufficient evidence". Ask the user to choose one:

- **(a)** make the design note and a one-line attack reason required, or
- **(b)** mark Testing and diagnosis from the reflections (chosen vs expected failure, plus text) and narrow the rubric.

The training rows must match what pupils will actually submit.

## 5. Adaption API facts

From docs.adaptionlabs.ai, read 2026-11-18. **Verify each against the live SDK first.**

- **Setup.** `pip install "adaption>=0.7.0"`; `from adaption import Adaption; client = Adaption()` reads `ADAPTION_API_KEY`. REST base: `https://api.prod.adaptionlabs.ai/api/v1`, Bearer auth. Inference stacks need SDK ≥ 0.16.0.
- **Upload.**
  - `client.datasets.upload_file("train.csv", processing_mode="raw", column_mapping={"prompt": ..., "completion": ...})`.
  - Poll `client.datasets.get_status(id)` until `row_count` is set.
  - Preference data uses `chosen`/`rejected`.
  - **Not documented:** the JSONL row schema for chat data. Test with a 5-row file.
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
3. **Mixed-family judge panel.** Claude plus one non-Anthropic model (Verga et al. 2024, arXiv 2404.18796). Agreement is a consistency check, not proof of validity.
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
3. **Codebook v0.** Write `marking/codebook.md`, turning each README anchor into concepts with boundary examples, and `marking/rules.ts`, a deterministic concept→level function with unit tests.
   - Independent judgement example: C1 uses this term's source (10 am); C2 spots the unresolved detail (accessible entrance); C3 assigns the decision to a suitable person (site manager); C4 makes no unsupported claim (e.g. the north gate).
   - *Done when* the README's worked example scores 2 and its "corrected only the time" example scores 1.
4. **More transfer scenarios.** Write 20–40 new scenarios like the ecology club, each a transcript plus a conflicting source plus an unresolved detail plus a proportionate next step, with checked reference answers. *Done when* each one has a reference answer that passes the codebook.
5. **Generator** (`scripts/marking-data/`).
   - Input packets come from `challengeEvidence()` and `simulateStudent`.
   - Pupil text is written by Claude to a spec grid with planted concepts; a share comes from a second model family.
   - Marking is a separate blind call.
   - The validator rejects a row if quoted evidence is missing from the response, source or trace; if any stated outcome or credit disagrees with the simulator; or if the JSON schema fails.
   - *Done when* the row-acceptance rate and the reasons for rejection are reported.
6. **Training set.**

   | Share | Content |
   |---|---|
   | About 75–80% | Synthetic concept-marking rows |
   | 10–15% | `Short-Answer-Feedback/saf_communication_networks_english` (CC-BY-4.0, human-written feedback) converted to the output schema |
   | About 10% | Robustness rows |

   Optionally add `IsmaelMousa/engsaf`; check its card for whether the rationales were written by humans. Never include ASAP-SAS. Hold out whole scenario families: 2–3 assessed challenges and some transfer scenarios. Upload with `processing_mode="raw"`.
7. **Train.** One `"instruction"` run on a small model (e.g. `google/gemma-3-4b-it`), after confirming the budget with the user. Record the run ID, `best_win_rate` and settings in `research/adaption-runs.md`.
8. **Evaluate (§6).** Report for the trained model, the base model and the prompted Claude marker:
   - concept accuracy against planted concepts,
   - level agreement,
   - robustness pass rate,
   - JSON validity,
   - evidence-grounding rate,
   - ASAP-SAS QWK (out-of-domain check of the method).

   Ship only if the trained model is close to the prompted marker.
9. **Serving.** Run marking and hints behind a server function (the app is static; Supabase is already used). Implement `AttackHintProvider` there. No keys in the browser.
10. **Later: hint preference training.** Pairs from `dmacjam/pedagogical-rewardmodel-data` (CC-BY-4.0: guiding question preferred, give-away rejected) plus pairs written for the six challenges, up to the 12,000 minimum.

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

## 9. Guardrails

- **No real pupil data** in training or prompts unless it is permissioned and de-identified. Pupils are aged 11–14.
- **Don't commit ASAP-SAS texts or scores.**
- **Secrets** (`ADAPTION_API_KEY`, `ANTHROPIC_API_KEY`, a second-vendor key) are never committed and never sent to the browser.
- **Check the terms** of Anthropic and Adaption on using model outputs for training before scaling up.
- **Ask the user** about the §4 decision, the budget, and anything that changes what pupils see.
