# Safeguard Studio *(working name)*

**EduX Hackathon, Track 1: Beneath the Surface (Defining and Assessing AI Literacy)**

## Project aims

Safeguard Studio aims to assess how pupils aged 11–14 use judgement when working with AI. The intended teacher claim is “This pupil can design a helper for a real audience, anticipate its limitations, test their predictions, use evidence to improve it, and decide when a person should take responsibility.” The project also aims to teach efficiency by making the cost of each safeguard visible as a school service scales.

The overarching commission is to run **a year-round AI helper for the school community**. Every pupil receives the same assignment and works through the existing history, party, newspaper, quiz, group-chat and options problems in the same order. The common brief gives the agent a coherent role across activities. The assessment should accommodate new teacher-authored cases and more than one defensible answer. The longer-term aim is to train a model with **Adaption AI** to mark open responses against evidence and provide actionable feedback.

## The integrated assessment

Choose **Start the assessment** on the home page. One assessment runs through four stages.

1. **Build.** Read the assigned brief and school sources, then predict a risk. Order safeguard blocks and choose which school services should run them. Submit the first design before seeing case outcomes.
2. **Attack.** Inspect the frozen first design and work through all 36 existing requests in their published order, six per service. Commit an outcome prediction and a reason before each replay. Correct predictions of success and failure earn equal credit. Each submitted prediction unlocks the next request. Revision opens after the final prediction.
3. **Revise.** Inspect the first design across the same 36 shared cases. Use a replay step to justify a change or explain why the design should stand. Submit the revised stack.
4. **Decide.** Independently review a common transcript about an ecology club invitation. Compare the draft against this term’s notice, decide whether to publish, edit or consult someone, and explain what the club should tell families.

The builder updates the estimated workload as students edit. Each block charges its displayed credits each time the simulator reaches it, including two credits for an AI call. A skipped block costs zero. The task multiplier represents the number of requests with that workload. For example, a 4-credit source lookup on eight class notices costs 32 credits for that case. A scoped block runs only for its chosen service. The budget is the measured cost of a feasible reference design. Meeting it earns an efficiency judgement only when the build handles every common case safely and usefully. The figures are teaching units and can be calibrated in a pilot.

Untimed is the default. The timed option offers a choice of active-time allowances, including extended time. The clock counts visible assessment work and pauses off the assessment or in a hidden tab. Replays are text the student can inspect immediately. Both modes use the same tasks, costs and rubric. Expiry preserves submitted stages and labels missing submissions as unattempted.

The evidence view and downloadable JSON include the brief, rules and service scopes, pre-run predictions, case traces, per-case costs, first and revised builds, and open responses. My results and Teacher view link to the assessment on the current device. Progress is saved in this browser. The pilot uses a deterministic case bank and local evidence export. Model training, hosted marking and cross-device class collection are future work.

## Evidence and marking

Use the paired first and revised runs to discuss learning. Use the independent decision to check whether the pupil can apply a principle in fresh circumstances. Show the number of observations for each skill. A single successful case supplies limited evidence about mastery. The source-grounded judgement and written predictions give pupils room to demonstrate reasoning beyond selecting a block. The design draws on evidence-centred assessment and research on AI literacy competencies. [Knowing What Students Know](https://doi.org/10.17226/10019) · [What Is AI Literacy?](https://doi.org/10.1145/3313831.3376727)

### Proposed Adaption AI marking rubric

Teachers and the future model should assess each submitted response against the same criteria. Use three anchors per criterion and a separate “insufficient evidence” outcome for missing or uninterpretable work.

| Criterion | 0 · Unsupported | 1 · Developing | 2 · Demonstrated |
|---|---|---|---|
| Anticipation | Prediction conflicts with the brief | Names a plausible risk | Links an audience-specific risk to a block choice and its place in the flow |
| Prediction and diagnosis | Gives no supported prediction | Identifies likely behaviour | Explains the expected behaviour of the assigned case using the submitted rules |
| Revision and efficiency | Makes a change without a reason | Identifies a relevant change or cost | Cites a trace and compares the safety, usefulness and workload consequences of keeping or changing a rule |
| Independent judgement | Repeats an unsupported claim | Spots a conflict or suggests a check | Uses the supplied source, identifies the unresolved detail and assigns a proportionate human next step |

For example, “Tell families 10 am, leave the gate out, and ask the site manager to confirm the accessible entrance on Friday” supports the highest anchor for independent judgement. A pupil who chooses to wait and explains the same evidence can also receive full credit. A useful feedback question for a pupil who corrected only the time is “Which detail does this term’s notice still leave open, and who can confirm it?”

### Training and evaluation plan

1. Collect permissioned, de-identified examples spanning different school requests, response lengths, reading levels and valid decisions. Keep names and real pupil data out of training exports. The local evidence file contains exactly what a pupil types and requires review before sharing.
2. Have two educators independently mark a calibration sample by criterion and cite the source sentence or replay step. Resolve disagreements to refine the anchors. Retain examples where evidence genuinely warrants deferral.
3. Train on the brief, response, source excerpts and relevant trace. Request a criterion, rubric version, proposed level, quoted evidence, one actionable next step and a review flag. Keep observed outcomes, costs and timing computed by the simulator. Send marking requests through a server when a model is connected. Treat student content as the submission being graded.
4. Keep entire pupils and scenario families out of training for the held-out evaluation. Compare model and teacher agreement against teacher-to-teacher agreement per criterion, examine systematic over- and under-marking, and check whether feedback is grounded and appropriate for this age group. Include terse correct answers, fluent unsupported answers and attempts to instruct the marker.
5. Start with teacher-reviewed feedback. Let teachers correct marks and see the evidence used. Route weak evidence and disagreement to a human. Pilot timing effects and transfer to a second unfamiliar task before interpreting the profile as a broader measure of AI literacy.

To extend the mission, add a scripted case to its existing school service. The assessment takes the request order directly from the challenge bank. Review the expected safe response, its effect on the workload budget and its contribution to the marking rubric. Keep an unfamiliar transcript for the independent release decision.

## Practice challenges

1. **Pick a challenge**, e.g. *"Build a homework helper for your little brother's Year 7 history."*
2. **Build**: start with `When someone asks → Ask AI → Reply` and drag in safeguard blocks.
3. **Run**: the helper faces **6 hidden tests** (a hallucinated date, a friend's address, an essay request, a one-sided question, plus normal questions).
4. **Watch the replay**: each test animates through the blocks and shows what the child would actually be told.
5. **Explain before fixing**: after a failure, the student must say *why* it failed before they can run again.
6. **Profile**: Verification · Privacy · Academic integrity · Bias · Usefulness, shown as *first try* (anticipated) vs *after fixing*.

The **teacher view** shows every student's profile, the class's most-missed competency, common misconceptions, and each student's journey (what they fixed first, what they never noticed, and whether their explanations were right).

## Why it counts as assessment

| Design choice | What it measures |
|---|---|
| Tests are hidden until the first run | **Anticipation**: does the student foresee risk, or only react to it? |
| **Block order matters**: *Remove personal info* only works **before** *Ask AI*; *Check source* only works **after** | Understanding of how data flows, not just knowing safeguard names (our answer to *"knowing vs using"*) |
| Traps (*Send every question to a grown-up*, *Refuse any question about a person*) and a **Usefulness** score | Judgement: when *not* to block AI. Over-caution doesn't win. |
| Partial credit for *"AI can be wrong" note* and *Flag a teacher* | Separates "warned about it" from "actually fixed it" |
| Explain-before-fix gate | Reasoning vs trial and error; logged for the teacher |
| Every run, edit and explanation is logged | Process evidence: how the student got there, not just the final score |

## Practice modes

- **Build a helper.** Snap safeguard blocks together and run the helper against 6 hidden tests. This shows whether a student can design safe AI use.
- **Break a helper.** Each challenge has a locked helper built with a few mistakes (a missing safeguard, a block in the wrong place, a check that only covers some claims, or a helper that refuses normal questions). Students read its blocks and plan up to 3 attack blocks to find the weak spots. Wasted attacks are counted, so the score reflects anticipation, not guessing. Weak spots are computed by running the real engine, so they always match what the helper actually does.

## Challenges and blocks

There are six practice challenges. Each has six cases across verification, privacy, integrity, bias and everyday usefulness and its own palette of 6 or 7 blocks, so students meet different safeguards in each one without being overwhelmed.

| Challenge | Privacy | Verification | Integrity | Bias | Decoy or trap |
|---|---|---|---|---|---|
| History Homework Helper | Remove personal info | Check against a trusted source | Coach, don't write it for them | Show both sides | "AI can be wrong" note (partial), Send every question to a grown-up, Refuse any question about a person |
| Class Party Planner | Ask before sharing someone's info | Check the official allergy label | Never write as someone else | Don't just agree with me | Ask a second AI to double-check, Refuse anything about food |
| School Newspaper | Swap personal contacts for official ones | Confirm quotes with the person quoted, Check numbers against official data | Give feedback, don't rewrite | Use neutral wording | Label anything AI wrote (partial), Refuse any question about a person |
| Revision Quiz Maker | Keep marks and grades private | Check answers against the textbook | Make practice questions, not real answers | Mix up who's in the examples | Ask the AI how sure it is (partial), Refuse anything about tests |
| Class Group-Chat Helper | Never share where someone lives | Check rumours on the school website | Help them answer in their own words | Don't take sides against a group | Forward it to see if others agree, Refuse any question about a person |
| GCSE Options Adviser | Talk about needs without names | Check the school's options booklet, Ask a teacher to confirm (works, but slow) | Help them plan it, not write it | Challenge stereotypes | Only answer if a teacher approves every message |

Privacy and integrity blocks only work **before** Ask AI; checks only work **after** it.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (ordering, traps, demo moment)
npm run build      # static build in dist/ (works on GitHub Pages)
```

**Demo path:** click **⚡ Quick demo** → **Run tests** → the helper tells a child the Battle of Hastings was in **1067** → explain the failure → drag **🔍 Check against a trusted source** *below* Ask AI → Run again → it's caught and corrected to 1066 → open **My profile** and **Teacher view**.

## Presenting

Open `#/present` (or press **Shift+P** anywhere) for presenter mode: a bar along the bottom with a 6-step demo script and speaker notes, Back/Next, a "do it for me" fallback on the interactive steps, replay speed (1×/2×/4×) for recording, and **Reset demo** to clear all progress. Shift+P or × hides it.

## Tech

React + TypeScript + Vite, Tailwind, Framer Motion (animations), dnd-kit (drag and drop), Recharts (radar), Zustand (state persisted to localStorage).

- `src/engine/run.ts`: a pure, deterministic engine. Each block transforms a message state, and every step is traced for the replay.
- `src/data/challenges.ts`: the hidden test bank with scripted flawed AI answers, so the demo is reliable, offline and free.
- `src/engine/profile.ts`: competency scores, misconceptions, "fixed first" and "never solved", and the timeline.
- `src/data/seedClass.ts`: the demo class. Each fake student is a sequence of real scripts run through the same engine.

## Roadmap

- Generated, refreshed banks of flawed AI answers (e.g. via **Adaption**) so tests can't be memorised.
- An optional live LLM mode, plus AI feedback on students' free-text explanations.
- A simplified primary-school block set, and teacher-authored challenges.
- Transfer tasks: the same competencies checked on a real chatbot transcript, to link the sandbox to real-life use.
