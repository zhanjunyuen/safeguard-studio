import { getChallenge } from '../data/challenges';
import { CURVEBALLS } from '../data/curveballs';
import { TRANSFER } from '../data/mission';
import { runCurveball } from './curveball';
import { ECOLOGY_ANCHORS, type MarkRequest } from './marking';
import { evaluate, handled, type Desk, type Rule } from './mission';
import { labelOf } from './scriptText';
import type { BlockType } from '../types';

/**
 * The evidence packet the AI marker reads with a pupil's answer. Same shape, field for field,
 * as the training contexts (scripts/marking-data/contexts.ts), and recomputed here from the
 * simulator, so the model sees exactly the facts the pupil saw.
 */

const flow = (blocks: BlockType[]) => blocks.map(labelOf).join(' → ');
const rulesOf = (desk: string, blocks: BlockType[]): Rule[] => blocks.map((type) => ({ type, scope: desk as Desk }));

/** The challenge a request is about: its explicit id (Level 2 is "<desk>@2"), else the desk id. */
function challengeFor(req: MarkRequest) {
  const id = ('challengeId' in req && req.challengeId) || (req.criterion === 'anticipation' ? req.desk : undefined);
  const c = id ? getChallenge(id) : undefined;
  return c ? { c, base: { challenge: c.title, challengeId: c.id, level: c.id.endsWith('@2') ? 2 : 1, audience: c.audience, story: c.story } } : null;
}

export function markPacket(req: MarkRequest): unknown {
  if (req.criterion === 'judgement') {
    // The release decision is always the ecology club scenario in the app.
    return { scenario: 'Ecology club pond survey', request: TRANSFER.request, helperDraft: TRANSFER.reply, currentSource: TRANSFER.source };
  }
  const found = challengeFor(req);
  if (req.criterion === 'testing') {
    const desk = found ? found.c.id.split('@')[0] : '';
    const rules = rulesOf(desk, req.blocks);
    const results = found ? req.planned.map((p) => evaluate(rules, p.id)) : [];
    return {
      ...found?.base, frozenBuild: flow(req.blocks), attackCases: req.planned, ...(req.custom && { pupilWrittenRequestAndAiJudgement: req.custom }),
      simulator: found
        ? results.map((x, i) => ({ case: req.planned[i].id, outcome: handled(x) ? 'held' : x.result.blocked ? 'refused (safe but not useful)' : x.result.outcome === 'partial' ? 'partly got through' : 'got through', why: x.result.explanation }))
        : req.planned.map((p) => ({ case: p.id, outcome: req.broke.includes(p.id) ? 'got through' : 'held' })),
    };
  }
  if (req.criterion === 'anticipation') {
    const cb = CURVEBALLS[req.desk];
    const res = cb ? runCurveball(rulesOf(req.desk, req.blocks), req.desk) : null;
    return {
      ...found?.base, frozenBuild: flow(req.blocks),
      ...(cb ? { curveball: { title: cb.test.title, request: cb.test.question, context: cb.context ?? null, risk: cb.risk } } : {}),
      pupilChoice: req.prediction === 'handles' ? 'The helper will cope' : 'It will get through',
      simulator: res ? { handled: req.handled, outcome: res.outcome, reply: res.reply, why: res.explanation } : { handled: req.handled },
    };
  }
  // Revision: every test on the frozen and the latest build.
  const desk = found ? found.c.id.split('@')[0] : '';
  const run = (blocks: BlockType[]) => (found ? found.c.tests.map((t) => evaluate(rulesOf(desk, blocks), t.id)) : []);
  const results = (rows: ReturnType<typeof run>) => rows.map((x) => ({ case: x.result.testId, title: found!.c.tests.find((t) => t.id === x.result.testId)?.title, outcome: handled(x) ? 'handled' : x.result.outcome }));
  const before = run(req.before), after = run(req.after);
  return {
    ...found?.base, frozenBuild: flow(req.before), latestBuild: flow(req.after), changed: req.before.join() !== req.after.join(),
    frozenResults: results(before), latestResults: results(after),
    creditsBefore: req.creditsBefore, creditsAfter: req.creditsAfter,
  };
}

/** The scenario anchors sent with a judgement answer (the training rows always had them). */
export const markAnchors = (req: MarkRequest) => (req.criterion === 'judgement' ? req.anchors ?? ECOLOGY_ANCHORS : undefined);
