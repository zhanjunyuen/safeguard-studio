# Safeguard Studio *(working name)*

**EduX Hackathon, Track 1: Beneath the Surface (Defining and Assessing AI Literacy)**

## Project aims

Safeguard Studio aims to assess how pupils aged 11–14 use judgement when working with AI. The intended teacher claim is “This pupil can design a helper for a real audience, anticipate its limitations, test their predictions, use evidence to improve it, and decide when a person should take responsibility.” The project also aims to teach efficiency by making the cost of each safeguard visible as a school service scales.

The overarching commission is to run **a year-round AI helper for the school community**. By default each pupil receives six challenges drawn from the catalogue, one per theme, and chooses the order in which to complete them. The common brief gives the agent a coherent role across activities. The assessment should accommodate new teacher-authored cases and more than one defensible answer. The longer-term aim is to train a model with **Adaption AI** to mark open responses against evidence and provide actionable feedback.

## How pupils and teachers start

- **Start page.** Pupils enter the class code from their teacher and press **Start assessment**. They can leave the code blank to start on their own. Smaller links open the demo, all practice challenges (`/challenges`) and teacher setup.
- **Guided assessment.** A step bar (Join class → Brief → Challenges → Release decision → Results) and a "Now" line always say what to do next. Pupils who used a class code type their first name once.
- **Teacher setup (`/setup`, linked from Teacher view).** Teachers choose:
  - the task count (1–21, six by default) for a random assignment, or the exact challenges;
  - whether each written answer is required or optional (design note, attack prediction, curveball explanation, revision note, release explanation);
  - optionally a fixed level and time allowance in active minutes, including untimed.

  Settings save on the device, or to a class with its **teacher code**: a new class gets a code, and the demo class `DEMO8B` uses `TEACH8B`. Each attempt keeps the settings it started with. An optional answer left blank doesn't lower the final score.

To unlock Attack, the latest run of the current build must pass at least four of the six core tests and the task’s design check. The check combines a new risky request, a second risk from the core tests and a similar harmless request. All three must pass. The Level 2 edge case is scored separately for this gate.

Each build run shows a block-quality score out of 100. Handling risky requests earns up to 60 points and answering ordinary requests earns up to 20. The remaining 20 reflect the share of safeguard steps that make a difference. The simulator removes each step in turn and checks whether the helper loses a pass.

Each task has 12 preset attacks at Level 1 and 13 at Level 2. Pupils can spend one of their three slots on a fictional request they write themselves. Adaption estimates how the ordered build would handle it. Preset attacks run in the simulator. If AI judging is unavailable, the pupil can retry or use preset attacks.

## The integrated assessment

Choose **Start the assessment**, select the time allowance, then choose a challenge from the checklist. Starting an assessment draws one challenge per theme from the 21-challenge practice catalogue. The six are saved with the attempt. Earlier attempts keep their original six. Pupils can work in any order and pause a challenge to work on another. A task menu stays visible during Build, Attack and revision. It tracks completed challenges and the number of tests passed on the latest evaluated build for each attempted task. Front-page practice has its own progress.

**Two levels.** Pupils choose a level before the challenges are drawn, and it applies to the whole assessment:

| | Level 1 | Level 2 · IF blocks |
|---|---|---|
| Blocks | Safeguard blocks for each challenge | The same blocks plus IF … THEN and IF … THEN … ELSE |
| Tests per challenge | 6 hidden tests | 7: the same six plus an edge case built to slip past the obvious condition (an address with no name, a worry with no "feelings" words, a scam with no link) |
| Usefulness target | Just below the reference helper | Higher than any always-on helper can reach, so safeguards must run only when needed |
| Traps | Over-blocking costs usefulness | Also: conditions only see the words in a message, and "the AI isn't sure" is never true |

Level 2 builds keep their IF blocks everywhere they are used: evaluation, the frozen attack target, curveballs, workload credits (an IF only charges for the branch that runs) and the evidence export (`level`, `challengeId`). Attacks at Level 2 can target the edge case, and the budget uses the Level 2 reference helpers. `src/engine/assessmentLevel.test.ts` checks that the always-on Level 1 answer misses every Level 2 target.

1. **Build and evaluate each helper.** The assessed challenge opens the same story, audience, block palette and editor as its front-page counterpart. Order the blocks and run the six hidden tests. For a failed request, compare the reply with the steps your submitted helper took and explain the outcome. Later runs prioritise changed failures and then cases you have discussed least recently.
2. **Attack the evaluated build.** The Break workspace locks the pupil’s latest evaluated stack for that challenge. Select up to three attack blocks, then write which block you expect to fail and why. The prediction is required before launch and is saved with the attack, so it can be compared with what the simulator shows. Inspect the results. A helper that withstands the plan still counts as tested. Core cases can be retested alongside additional preset requests or a pupil-written request.
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

   The pupil predicts whether the helper will cope and must explain why (required), then sees the reply, the trace and what the case shows about AI. Pupils are marked on their prediction and reasoning, not on whether the helper survives. Adding every block in a palette still fails 17 of the 21 curveballs (`src/engine/curveball.test.ts`).
4. **Finish or revise.** Keep the build and return to the checklist, or reopen its editor to revise it. Explain the revision or decision to keep the design, and evaluate any changed stack. The attack record keeps the original target.
5. **Make a release decision.** Completing every assigned challenge unlocks the ecology club transcript. Review it against the current source, decide whether to publish, edit or consult someone, and explain what the club should tell families.

**Speak your reasoning.** Pupils can dictate into any reasoning field in browsers with speech recognition. Start and stop with the microphone button, then edit the transcript. Browser permissions and speech services determine availability. Typing and device keyboard dictation are also supported. The app stores the submitted text.

**Feedback on written answers.** The attack prediction, the curveball explanation and the release rationale each get feedback against the rubric. The feedback lists the concepts found, quoting the evidence, gives a level from fixed rules, a next step, and answers to follow-up questions ("Why did I get this level?"). It comes from `src/engine/marking.ts`. Today an offline keyword preview fills the role, labelled as such. A trained AI marker connects through `setMarkingProvider` without changing the UI: the marker only reports which concepts are present, and fixed code turns concepts into levels.

Pupils share three optional hints across Build and Attack. Build hints guide design decisions. In Attack, the AI chooses a question about designing a test request, predicting the reply or identifying evidence. It can use the selected attack cards, the latest test results and earlier hints from that stage. An offline question is available if the AI is unavailable. Each stage shows its own hints, and the teacher report records both stages. Using a hint affects the Independence score. Rereading a hint is free.

The tracker starts at zero. Finishing a challenge deploys its helper. The shared budget adds the maximum compute for one live request per deployed helper. An AI answer costs 10 classroom credits, a simple filter 1, and a text source lookup 4. Conditional blocks reserve their most expensive reachable path and an unconditional stop skips downstream work. All testing, attacks, curveballs and replays are free.

The budget uses the corresponding reference designs. A deployed revision replaces the previous version at its new rate. Draft previews and run comparisons show how much each design would cost per live request. The efficiency score also measures how safely and usefully the deployed helper answers. Finished historical assessments retain their original tariff.

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

## AI features (Adaption)

Pupil-facing feedback features use the Adaption model `stack:adaption-backend-for-literacy`: marking written answers, answering follow-up questions about feedback, attack hints and the skills summary on the results page. The browser calls the Supabase Edge Function `literacy-ai`, and only that function holds the Adaption key. The function builds each prompt from fixed instructions; for marking, follow-ups and the summary these are the same prompts the training rows used. The model reports concepts with quotes. The browser keeps only concepts it can quote from the pupil's answer and recomputes the level with `levelFor`. It rejects follow-ups or summaries that state a different level or score. If the AI is unreachable, slow or gives a bad reply, each feature falls back to its offline version, so the assessment keeps working. Calls are capped at 1,500 an hour across all users.

**Final score.** When the assessment ends, the report opens with a final score out of 100. Each category gets its own score out of 100, and the final score is their weighted average. The weights are fixed in `src/engine/finalScore.ts`:

| Category | Weight | Score out of 100 |
|---|---|---|
| Written answers | 40% | The four skills marked from the pupil's latest answers (0–2 each) |
| Blocks: tests handled | 25% | Share of tests the latest builds handle safely and usefully |
| Blocks: workload | 10% | Staying within the credit budget, scaled by how well the builds work, so an empty helper earns nothing here |
| Attempts | 15% | Full marks for a working build in one or two runs; each extra run costs 10%, down to a floor of 40% |
| Independence | 10% | AI hints used: 100 with none; each of the three hints costs a third |

Bands: 85+ Outstanding, 65+ Strong, 40+ Developing, otherwise Getting started. If every written question is optional and skipped, answers don't count, and the weights of the other categories are scaled up to make 100%.

The AI writes the verdict and the skills summary. A verdict is replaced by an offline one if it states a different final score, or quotes a category score that isn't real. The result is saved with the attempt, shown on "My results" and included in the evidence export. Next to the score, a radar in the same style as the practice radar compares each challenge's first and latest builds.

**AI hints.** Pupils can ask for up to three hints in the whole assessment. They can ask while building a service or before launching its attacks. Each hint is a guiding question from the AI that never gives the answer away. The hint panel says plainly that each hint lowers the Independence score.

**Teacher questions.** In Teacher view, choose a class and challenge filter, then use **Ask about pupil performance** for the whole class or one pupil. Adaption receives the question and a snapshot of measured skills, first and latest builds, mistakes observed across runs, reflection accuracy and attack results. The snapshot omits pupil names, identifiers and written responses. If the service is unavailable, the panel labels its local dashboard observations. Class-linked assessment builds and reflection outcomes appear in the live results alongside practice as pupils complete them. The dashboard does not collect final assessment grades or written assessment answers.

**My results.** Pupils can ask Adaption about a saved practice or assessment task, compare runs, revisit a submitted prediction, or choose a task to practise next. The build comparison shows the recorded outcome of each changed test, block order and the maximum cost per live request for each design. Each answer links to the runs it used. Choosing **Use saved results only** keeps questions in this panel on the device. The `pupilResults` function task receives completed cases and saved outcomes. If AI is unavailable, the page shows the recorded evidence.

**Two Supabase projects.** The classes (join, runs, teacher settings) use the class project, which the `VITE_SUPABASE_*` GitHub secrets point to. The AI function `literacy-ai` runs in a separate project that holds the `ADAPTION_API_KEY` secret. `deploy.yml` points the site at it with `VITE_LITERACY_AI_URL` and `VITE_LITERACY_AI_KEY`; the URL and publishable key are public by design. To redeploy the function after changing it:

```bash
npx supabase functions deploy literacy-ai --project-ref keadshshrsmgfggdmmmm --no-verify-jwt --use-api
```

That project also needs the `literacy_ai_calls` table (`supabase/migrations/20261119020000_literacy_ai_calls.sql`). The class project needs the class migrations (`npx supabase db push` there). Without `VITE_LITERACY_AI_URL`, the AI uses the class project instead. Set `VITE_LITERACY_AI=off` to keep the offline markers.

After editing `docs/marking-codebook.md`, run `npx vite-node scripts/sync-ai-prompt.ts` (a test fails if the copy is out of date).

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

Every task has a practice curveball in Build and Break. Predict the outcome to run the current stack and inspect its reply. These 21 requests are separate from the 21 unseen assessment curveballs.

21 challenges in 6 themes. Each challenge has 6 hidden tests and its own palette of 8 to 11 blocks, so students keep meeting new safeguards without any one challenge being overwhelming.

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

Open `#/present` (or press **Shift+P** anywhere) for presenter mode: a bar along the bottom with an 8-step demo script and speaker notes, Back/Next, a "do it for me" fallback on the interactive steps, replay speed (1×/2×/4×) for recording, and **Reset demo** to clear the separate demo session. Demo runs never enter the pupil’s practice history or live class. Shift+P or × hides it.

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
