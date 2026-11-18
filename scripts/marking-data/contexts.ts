/**
 * Builds the evidence contexts that training rows are written against, straight from the
 * simulator, so every outcome, trace and credit in a row is exact (handoff §3: the simulator
 * is the source of truth).
 *
 *   npx vite-node scripts/marking-data/contexts.ts
 *
 * Writes scripts/marking-data/data/contexts.jsonl: one context per line with an id, the
 * criterion, whether it is held out, a `packet` (what the marker sees) and `facts` (what the
 * validator checks against). Deterministic: the same code always gives the same file.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { CHALLENGES, getChallenge } from '../../src/data/challenges';
import { CURVEBALLS } from '../../src/data/curveballs';
import { catalogue } from '../../src/data/mission';
import { evaluate, handled, totalCost, type Desk, type Rule } from '../../src/engine/mission';
import { runCurveball, curveballHandled } from '../../src/engine/curveball';
import { labelOf } from '../../src/engine/scriptText';
import { ECOLOGY_ANCHORS } from '../../src/engine/marking';
import scenarios from './transfer-scenarios.json';

/** Whole assessed challenges kept out of training, for the held-out evaluation (handoff §7 step 6). */
export const HELD_OUT_CHALLENGES = ['coding', 'firstaid', 'gamemod'];

const OUT = new URL('./data/', import.meta.url).pathname;

/** Small seeded random generator, so the file is reproducible. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const rand = rng(20261118);
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const rules = (desk: string, keys: string[]): Rule[] => keys.map(type => ({ type, scope: desk as Desk }));
const flow = (keys: string[]) => keys.map(labelOf).join(' → ');
const caseInfo = (challengeId: string, id: string) => {
  const t = getChallenge(challengeId)!.tests.find(x => x.id === id)!;
  return { id, label: t.attackLabel, title: t.title, category: t.category };
};

/** A spread of realistic frozen builds for one challenge and level: reference, break target, bare, and the reference missing one safeguard. */
function builds(challengeId: string): { name: string; keys: string[] }[] {
  const c = getChallenge(challengeId)!;
  const out = [
    { name: 'reference', keys: c.ideal },
    { name: 'break-target', keys: c.breakTarget },
    { name: 'bare', keys: ['ask_ai'] },
  ];
  c.ideal.forEach((k, i) => { if (k !== 'ask_ai') out.push({ name: `reference-minus-${k}`, keys: c.ideal.filter((_, j) => j !== i) }); });
  const seen = new Set<string>();
  return out.filter(b => !seen.has(b.keys.join()) && seen.add(b.keys.join()));
}

const contexts: Record<string, unknown>[] = [];

for (const d of catalogue) {
  for (const level of [1, 2] as const) {
    const challengeId = level === 2 ? `${d.id}@2` : d.id;
    const c = getChallenge(challengeId);
    if (!c) continue;
    const holdOut = HELD_OUT_CHALLENGES.includes(d.id);
    const base = { challenge: c.title, challengeId, level, audience: c.audience, story: c.story };
    const bs = builds(challengeId);

    // Testing: an attack plan of 1–3 cases against a frozen build.
    for (const b of bs) {
      const r = rules(d.id, b.keys);
      const all = c.tests.map(t => t.id);
      const failing = all.filter(id => !handled(evaluate(r, id)));
      // Usually include a failing case if there is one (pupils attack after seeing results).
      const n = 1 + Math.floor(rand() * 3);
      const plan = new Set<string>();
      if (failing.length && rand() < 0.75) plan.add(pick(failing));
      while (plan.size < Math.min(n, all.length)) plan.add(pick(all));
      const ids = [...plan];
      const results = ids.map(id => evaluate(r, id));
      const broke = ids.filter((_, i) => !handled(results[i]));
      contexts.push({
        id: `T:${challengeId}:${b.name}`, criterion: 'testing', holdOut, build: b.name,
        packet: { ...base, frozenBuild: flow(b.keys), attackCases: ids.map(id => caseInfo(challengeId, id)),
          simulator: results.map((x, i) => ({ case: ids[i], outcome: handled(x) ? 'held' : x.result.blocked ? 'refused (safe but not useful)' : x.result.outcome === 'partial' ? 'partly got through' : 'got through', why: x.result.explanation })) },
        facts: { blocks: b.keys, planned: ids.map(id => caseInfo(challengeId, id)), broke },
      });
    }

    // Anticipation: the curveball against a frozen build, with the pupil's choice.
    const cb = CURVEBALLS[d.id];
    if (cb) for (const b of bs) {
      const res = runCurveball(rules(d.id, b.keys), d.id);
      const ok = curveballHandled(res);
      for (const prediction of ['handles', 'struggles'] as const) {
        contexts.push({
          id: `A:${challengeId}:${b.name}:${prediction}`, criterion: 'anticipation', holdOut, build: b.name,
          packet: { ...base, frozenBuild: flow(b.keys), curveball: { title: cb.test.title, request: cb.test.question, context: cb.context ?? null, risk: cb.risk },
            pupilChoice: prediction === 'handles' ? 'The helper will cope' : 'It will get through',
            simulator: { handled: ok, outcome: res.outcome, reply: res.reply, why: res.explanation } },
          facts: { desk: d.id, blocks: b.keys, prediction, handled: ok, predictionCorrect: (prediction === 'handles') === ok, risk: cb.risk, lesson: cb.lesson },
        });
      }
    }

    // Revision: before = a weaker frozen build, after = the reference (a fix) or the same build (a keep).
    for (const b of bs.filter(x => x.name !== 'reference')) {
      for (const after of [c.ideal, b.keys]) {
        const before = rules(d.id, b.keys), aft = rules(d.id, after);
        const beforeCases = c.tests.map(t => evaluate(before, t.id)), afterCases = c.tests.map(t => evaluate(aft, t.id));
        const kept = after === b.keys;
        contexts.push({
          id: `R:${challengeId}:${b.name}:${kept ? 'kept' : 'fixed'}`, criterion: 'revision', holdOut, build: b.name,
          packet: { ...base, frozenBuild: flow(b.keys), latestBuild: flow(after), changed: !kept,
            frozenResults: beforeCases.map(x => ({ case: x.result.testId, title: caseInfo(challengeId, x.result.testId).title, outcome: handled(x) ? 'handled' : x.result.outcome })),
            latestResults: afterCases.map(x => ({ case: x.result.testId, title: caseInfo(challengeId, x.result.testId).title, outcome: handled(x) ? 'handled' : x.result.outcome })),
            creditsBefore: totalCost(beforeCases), creditsAfter: totalCost(afterCases) },
          facts: { before: b.keys, after, failing: beforeCases.filter(x => !handled(x)).map(x => caseInfo(challengeId, x.result.testId)),
            creditsBefore: totalCost(beforeCases), creditsAfter: totalCost(afterCases) },
        });
      }
    }
  }
}

// Judgement: one context per release-decision scenario.
for (const s of scenarios) {
  contexts.push({
    id: `C:${s.id}`, criterion: 'judgement', holdOut: s.holdOut,
    packet: { scenario: s.title, request: s.request, helperDraft: s.reply, currentSource: s.source },
    facts: { anchors: s.id === 'ecology' ? ECOLOGY_ANCHORS : s.anchors, reference: s.reference },
  });
}

mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'contexts.jsonl', contexts.map(c => JSON.stringify(c)).join('\n') + '\n');
const count = (k: string) => contexts.filter(c => c.criterion === k).length;
console.log(`${contexts.length} contexts: testing ${count('testing')}, anticipation ${count('anticipation')}, revision ${count('revision')}, judgement ${count('judgement')}; held out ${contexts.filter(c => c.holdOut).length}. Challenges in catalogue: ${CHALLENGES.filter(c => !c.id.includes('@')).length}`);
