# Safeguard Studio *(working name)*

**EduX Hackathon, Track 1: Beneath the Surface (Defining and Assessing AI Literacy)**

Students show their AI literacy by **building an AI helper out of blocks**, and we assess them on how it holds up when things go wrong.

Tests and surveys measure what students *say* about AI. Safeguard Studio measures what they *do*: whether they anticipate a made-up fact, a privacy leak, a "write my essay" request or a loaded question, and whether they can fix their helper when it fails.

## How it works

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

## Two modes

- **Build a helper.** Snap safeguard blocks together and run the helper against 6 hidden tests. This shows whether a student can design safe AI use.
- **Break a helper.** Each challenge has a locked helper built with a few mistakes (a missing safeguard, a block in the wrong place, a check that only covers some claims, or a helper that refuses normal questions). Students read its blocks and plan up to 3 attack blocks to find the weak spots. Wasted attacks are counted, so the score reflects anticipation, not guessing. Weak spots are computed by running the real engine, so they always match what the helper actually does.

## Challenges and blocks

There are six challenges. Each has 6 hidden tests (one each for verification, privacy, integrity and bias, plus two normal questions) and its own palette of 6 or 7 blocks, so students meet different safeguards in each one without being overwhelmed.

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

## Class backend (optional, Supabase)

Without keys the app runs entirely in the browser. With Supabase, students join with a class code and first name, and the Teacher view gets a **Live class** toggle that shows their real runs (refreshing every 5 seconds).

1. Supabase dashboard → **Project Settings → Integrations → GitHub**: connect `zhanjunyuen/safeguard-studio`, Supabase directory `supabase`, production branch `main`, deploy to production on. The migration in `supabase/migrations/` then runs automatically and creates a demo class `DEMO8B`.
2. **Project Settings → API**: copy the Project URL and the `anon` public key into GitHub → repo **Settings → Secrets and variables → Actions** as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then re-run the deploy.
3. For local dev, put the same two values in `.env.local` (see `.env.example`).

Privacy: only a first name and class code are stored. The browser key cannot read tables directly; all access is through database functions that need the class code.

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
