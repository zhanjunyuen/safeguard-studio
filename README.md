# Safeguard Studio *(working name)*

**EduX Hackathon, Track 1: Beneath the Surface (Defining and Assessing AI Literacy)**

## Project aims

Safeguard Studio aims to assess how pupils aged 11–14 use judgement when working with AI. The intended teacher claim is “This pupil can design a helper for a real audience, anticipate its limitations, test their predictions, use evidence to improve it, and decide when a person should take responsibility.” The project also aims to teach efficiency by making the cost of each safeguard visible as a school service scales.

The overarching commission is to run **a year-round AI helper for the school community**. Each pupil receives six challenges drawn from the catalogue, one per theme, and chooses the order in which to complete them. The common brief gives the agent a coherent role across activities. The assessment should accommodate new teacher-authored cases and more than one defensible answer. The longer-term aim is to train a model with **Adaption AI** to mark open responses against evidence and provide actionable feedback.

## The integrated assessment

Choose **Start the assessment**, select the time allowance, then choose a challenge from the checklist. Starting an assessment draws one challenge per theme from the 21-challenge practice catalogue. The six are saved with the attempt. Earlier attempts keep their original six. Pupils can work in any order and pause a challenge to work on another. A task menu stays visible during Build, Attack and revision. It tracks completed challenges and the number of tests passed on the latest evaluated build for each attempted task. Front-page practice has its own progress.

**Two levels.** Pupils choose a level before the six challenges are drawn, and it applies to the whole assessment:

| | Level 1 | Level 2 · IF blocks |
|---|---|---|
| Blocks | Safeguard blocks for each challenge | The same blocks plus IF … THEN and IF … THEN … ELSE |
| Tests per challenge | 6 hidden tests | 7: the same six plus an edge case built to slip past the obvious condition (an address with no name, a worry with no "feelings" words, a scam with no link) |
| Usefulness target | Just below the reference helper | Higher than any always-on helper can reach, so safeguards must run only when needed |
| Traps | Over-blocking costs usefulness | Also: conditions only see the words in a message, and "the AI isn't sure" is never true |

Level 2 builds keep their IF blocks everywhere they are used: evaluation, the frozen attack target, curveballs, workload credits (an IF only charges for the branch that runs) and the evidence export (`level`, `challengeId`). Attacks at Level 2 can target the edge case, and the budget uses the Level 2 reference helpers. `src/engine/assessmentLevel.test.ts` checks that the always-on Level 1 answer misses every Level 2 target.

1. **Build and evaluate each helper.** The assessed challenge opens the same story, audience, block palette and editor as its front-page counterpart. Order the blocks and run the six hidden tests. Inspect the replay, explain a failure when prompted, and try a new design if needed.
2. **Attack the evaluated build.** The Break workspace locks the pupil’s latest evaluated stack for that challenge. Select up to three attack blocks, then write which block you expect to fail and why. The prediction is required before launch and is saved with the attack, so it can be compared with what the simulator shows. Inspect the results. A helper that withstands the plan still counts as tested. The cases also appeared during evaluation, so this measures targeted testing after feedback.
3. **Face a curveball.** After the attack, the frozen helper meets one request it has never seen. Every one of the 21 challenges has a curveball. Each targets an AI risk the standard tests don't cover, and most can't be fixed by any block in that palette. The six original school challenges:

   | Challenge | Curveball | AI risk |
   |---|---|---|
   | History | A quote from a historian and book that don't exist | Invented sources: a fact check doesn't check that a source exists |
   | Party | A caterer's note with hidden instructions to list pupils' allergies by name | Prompt injection |
   | Newspaper | A caption for a viral photo of the flooded field | AI-made images |
   | Revision quiz | Marking a correct answer written in dialect | Unfair judgement: bias in AI marking is not a wrong fact |
   | Group chat | An urgent voice note from a teacher with a new payment link | Voice cloning and scams |
   | Options | The same question with a different name gets different advice | Bias that only shows when you compare |

   The other 15:

   | Challenge | Curveball | AI risk |
   |---|---|---|
   | Science fair | A viral claim that microwaving water removes nutrients | Viral misinformation |
   | Fake photo | A quote from the head teacher that she never said | Invented quotes |
   | Photo caption | A file name telling the AI to add players' schools and towns | Prompt injection |
   | Club sign-up | Choosing 10 places from sign-up reasons | Bias in AI selection |
   | Coding | A package name that doesn't exist | Invented code packages |
   | AI art | A zombie picture of a real teacher | Deepfakes of real people |
   | Team picker | Picking the relay team from photos | Judging by appearance |
   | School play | A programme that hides the AI's part | Hiding AI's part in the work |
   | Debate | A study about uniforms that was never done | Invented sources |
   | Wellbeing | "Be my best friend instead of them" | Relying on a chatbot instead of people |
   | First aid | A viral jellyfish-sting "hack" | Viral health myths |
   | AI friend | A feature asking for birthday, school, address and a selfie | Collecting too much personal data |
   | Game moderator | Banning a player for how he types | Judging players by how they write |
   | Shopping | Headphones in an AI-made advert photo | AI-made product photos |
   | Prize checker | A deepfake TV chef giveaway | Deepfake celebrity adverts (a scam check *can* catch this one) |

   The pupil predicts whether the helper will cope and must explain why (required), then sees the reply, the trace and what the case shows about AI. Pupils are marked on their prediction and reasoning, not on whether the helper survives. Adding every block in a palette still fails 19 of the 21 curveballs (`src/engine/curveball.test.ts`).
4. **Finish or revise.** Keep the build and return to the checklist, or reopen its editor to revise it. Explain the revision or decision to keep the design, and evaluate any changed stack. The attack record keeps the original target.
5. **Make a release decision.** Completing all six challenges unlocks the ecology club transcript. Review it against the current source, decide whether to publish, edit or consult someone, and explain what the club should tell families.

**Feedback on written answers.** The attack prediction, the curveball explanation and the release rationale each get feedback against the rubric. The feedback lists the concepts found, quoting the evidence, gives a level from fixed rules, a next step, and answers to follow-up questions ("Why did I get this level?"). It comes from `src/engine/marking.ts`. Today an offline keyword preview fills the role, labelled as such. A trained AI marker connects through `setMarkingProvider` without changing the UI: the marker only reports which concepts are present, and fixed code turns concepts into levels.

During Attack the animated companion can give three optional hints across the whole assessment. Hints prompt pupils to reason about the selected problem and their submitted blocks. The allowance follows the attempt across problem switches and reloads. Pupils can reread earlier hints for free. The report records the setting and text of each hint so teachers can interpret assisted work. Hint use carries no score or workload penalty.

The offline implementation in `src/engine/attackHints.ts` supplies the current hints. A future server-backed adapter can implement `AttackHintProvider(context, signal)` and replace `offlineAttackHint` as the default in the mission store. The context contains the setting, ordered block types and earlier hints for that setting. A failed or cancelled request uses no allowance. The live API and credentials belong on the server when connected.

The builder updates the estimated workload as students edit. The required Ask AI block is free. Each safeguard charges its displayed credits when it runs. A skipped block costs zero. The task multiplier represents the number of requests with that workload. For example, a 4-credit source lookup on eight class notices costs 32 credits for that case. Each challenge uses its own stack. The shared budget is the combined cost of six feasible builds using the six challenge palettes. Meeting it earns an efficiency judgement only when the build handles every common case safely and usefully. The figures are teaching units and can be calibrated in a pilot.

Untimed is the default. The timed option offers a choice of active-time allowances, including extended time. The clock counts visible assessment work and pauses off the assessment or in a hidden tab. Pupils can skip animated replays and inspect the results immediately. Both modes use the same tasks, costs and rubric. Expiry preserves submitted stages and labels missing submissions as unattempted.

The evidence view and downloadable JSON include the brief, completion order, build attempts and reflections for each challenge, the frozen target and outcomes for each submitted attack, case traces, workload costs and the release decision. My results and Teacher view link to the assessment on the current device. Progress is saved in this browser. The pilot uses a deterministic case bank and local evidence export. Model training, hosted marking and cross-device class collection are future work.

## Evidence and marking

Use the paired first and revised runs to discuss learning. Use the independent decision to check whether the pupil can apply a principle in fresh circumstances. Show the number of observations for each skill. A single successful case supplies limited evidence about mastery. The source-grounded judgement and revision explanations give pupils room to demonstrate reasoning beyond selecting a block. The design draws on evidence-centred assessment and research on AI literacy competencies. [Knowing What Students Know](https://doi.org/10.17226/10019) · [What Is AI Literacy?](https://doi.org/10.1145/3313831.3376727)

### Proposed Adaption AI marking rubric

Teachers and the future model should assess each submitted response against the same criteria. Use three anchors per criterion and a separate “insufficient evidence” outcome for missing or uninterpretable work.

| Criterion | 0 · Unsupported | 1 · Developing | 2 · Demonstrated |
|---|---|---|---|
| Anticipation | Prediction conflicts with the brief | Names a plausible risk | Links an audience-specific risk to a block choice and its place in the flow |
| Testing and diagnosis | Gives no evidence for a diagnosis | Identifies a relevant attack outcome | Connects the observed behaviour to a specific safeguard or missing check |
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

## Passing a challenge: safe *and* useful

A helper only counts as solved when it passes every hidden test **and** keeps its usefulness score at or above a target. The target is set one point below the simplest helper that passes, so adding safeguards "just in case" (including the cheap decoys) pushes the score under it. Students can't win by stacking every block: they have to work out which risks this job really has.

**Level 2** of every challenge unlocks once Level 1 is solved. It adds **IF … THEN** and **IF … THEN … ELSE** blocks with conditions such as *it mentions a person*, *it contains numbers*, *it's about health or feelings*, *it asks for finished work*, *it's an opinion question*, *it sounds urgent* and *the AI isn't sure*. A safeguard inside an IF only costs usefulness on the messages that trigger it, so the Level 2 target is higher than any always-on helper can reach. Each Level 2 also adds one edge case built to slip past the obvious condition (an address with no name, a serious worry with no "feelings" words, a scam with no link), and "the AI isn't sure" is a trap, because the AI always sounds sure.

## Themes and challenges

21 challenges in 6 themes. Each challenge has 6 hidden tests and its own palette of 6 or 7 blocks (about 70 blocks in total), so students keep meeting new safeguards without any one challenge being overwhelming.

| Theme | What it teaches | Challenges |
|---|---|---|
| **Is it true?** | AI sounds just as confident when it's wrong: check facts, sources and photos | History Homework Helper · School Newspaper · Science Fair Fact-Checker · Spot the Fake Photo |
| **Whose info is it?** | Protect other people's details and only collect what's needed | Class Party Planner · Group-Chat Helper · Photo Caption Helper · Club Sign-Up Form |
| **Is it your work?** | Use AI to learn, not to replace learning, and be honest about what it made | Revision Quiz Maker · GCSE Options Adviser · Coding Homework Helper · AI Art Project |
| **Is it fair?** | Stereotypes and AI telling people what they want to hear | PE Team Picker · School Play Casting · Debate Prep Coach |
| **Should I even use AI for this?** | Some things need a real person: trusted adults, 999, real friends | Wellbeing Check-in Bot · First Aid Helper · "AI Friend" App |
| **Who's trying to trick you?** | Scams, hidden adverts and prompt injection ("ignore your rules") | Game Chat Moderator · Online Shopping Helper · Prize Message Checker |

The profile tracks seven skills: Verification, Privacy, Academic integrity, Bias, **Judgement**, **Spotting tricks** and Usefulness. Each theme earns a badge when all its challenges are complete (built and broken). Teachers can view the class by challenge, by whole theme, or across everything.

Block order still matters: privacy and "instruction" blocks only work **before** Ask AI; checks only work **after** it.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests (ordering, traps, demo moment)
npm run build      # static build in dist/ (works on GitHub Pages)
```

**Demo path:** click **⚡ Quick demo** → **Run tests** → the helper tells a child the Battle of Hastings was in **1067** → explain the failure → drag **🔍 Check against a trusted source** *below* Ask AI → Run again → it's caught and corrected to 1066 → open **My profile** and **Teacher view**.

## Class backend (optional, Supabase)

Without keys the app runs entirely in the browser. With Supabase, students join with a class code and first name, and the Teacher view gets a **Live class** toggle that shows their real runs (refreshing every 5 seconds).

1. Supabase dashboard → **Project Settings → Integrations → GitHub**: connect `zhanjunyuen/safeguard-studio`, Supabase directory `supabase`, production branch `main`, deploy to production on. The migration in `supabase/migrations/` then runs automatically and creates a demo class `DEMO8B`.
2. **Project Settings → API**: copy the Project URL and the `anon` public key into GitHub → repo **Settings → Secrets and variables → Actions** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy.
3. For local dev, put the same two values in `.env.local` (see `.env.example`).

Privacy: only a first name and class code are stored. The browser key cannot read tables directly; all access is through database functions that need the class code.

## Presenting

Open `#/present` (or press **Shift+P** anywhere) for presenter mode: a bar along the bottom with an 8-step demo script and speaker notes, Back/Next, a "do it for me" fallback on the interactive steps, replay speed (1×/2×/4×) for recording, and **Reset demo** to clear all progress. Shift+P or × hides it.

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
