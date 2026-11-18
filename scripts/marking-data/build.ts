/**
 * Turns Claude-written items into training rows, and rejects any row that fails a check.
 *
 *   npx vite-node scripts/marking-data/build.ts
 *
 * Reads  data/contexts.jsonl            (from contexts.ts: simulator facts)
 *        data/items/*.jsonl             (marking items: pupil text + concepts + reasoning + feedback)
 *        data/followups/*.jsonl         (follow-up questions about a marked item, with answers)
 * Writes data/rows/{train,test}.jsonl   (prompt, completion, reasoning_trace + metadata)
 *        data/rows/report.json          (acceptance rate and reasons for rejection)
 *
 * Item format (one JSON object per line):
 *   ctx      context id from contexts.jsonl
 *   text     the pupil's answer
 *   author   "claude" | a hosted model id (pupil texts written outside Claude, handoff §7 step 5)
 *   tag      what was planted, e.g. "L2", "L1-T2only", "robust:injection"
 *   c        concept → exact quote (present) or null (absent). C4 is the exception: null = no
 *            out-of-date claim (present); a quote = the out-of-date claim the pupil asserts (absent).
 *            Computed concepts (A1) are filled from the simulator and must not be given.
 *   why      concept → one-sentence reason for the verdict (Claude's marking reasoning)
 *   fb       feedback (one specific point), ns: next step, flag: optional review flag reason
 *
 * Follow-up format: { item: "<ctx>#<n>", q, a, uses: [concept ids the answer relies on] }
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { levelFor, RUBRIC_VERSION, CRITERION_NAME, type Concept, type Criterion } from '../../src/engine/marking';

const DIR = new URL('./data/', import.meta.url).pathname;
const read = (f: string) => readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
const readDir = (d: string) => existsSync(DIR + d) ? readdirSync(DIR + d).filter(f => f.endsWith('.jsonl')).sort().flatMap(f => read(DIR + d + '/' + f).map((x, i) => ({ ...x, _file: f, _line: i + 1 }))) : [];

const contexts = new Map(read(DIR + 'contexts.jsonl').map(c => [c.id, c]));

import { CONCEPTS, RULE, INJECTION, inText, markingPrompt } from './prompt';
export { markingPrompt };

type Reject = { where: string; reason: string };
const rejects: Reject[] = [];
const rows: Record<string, unknown>[] = [];
const marked = new Map<string, { mark: Record<string, unknown>; text: string; ctx: Record<string, any> }>();
const ctxCount = new Map<string, number>();

for (const it of readDir('items')) {
  const where = `${it._file}:${it._line}`;
  const ctx = contexts.get(it.ctx);
  // Robustness variants get their own numbering ("#r0"), so regenerating them never shifts the keys follow-ups use.
  const robust = String(it.tag ?? '').startsWith('robust');
  const countKey = robust ? it.ctx + '~r' : it.ctx;
  const n = ctxCount.get(countKey) ?? 0; ctxCount.set(countKey, n + 1);
  const key = `${it.ctx}#${robust ? 'r' : ''}${n}`;
  const fail = (reason: string) => rejects.push({ where: `${where} (${key})`, reason });
  if (!ctx) { fail('unknown context'); continue; }
  const criterion = ctx.criterion as Criterion;
  const text: string = it.text ?? '';
  if (!text.trim()) { fail('empty text'); continue; }
  if (!it.c || !it.why || !it.fb || !it.ns) { fail('missing c/why/fb/ns'); continue; }

  const concepts: (Concept & { source: string; why: string })[] = [];
  let bad = '';
  for (const [id, label] of CONCEPTS[criterion]) {
    if (id === 'A1') {
      if (id in it.c) { bad = 'A1 is computed by the simulator and must not be given'; break; }
      const ok = ctx.facts.predictionCorrect as boolean;
      concepts.push({ id, label, present: ok, computed: true, source: 'simulator',
        why: `The pupil chose "${ctx.packet.pupilChoice}"; the simulator shows the helper ${ctx.facts.handled ? 'coped' : 'did not cope'}, so the prediction was ${ok ? 'right' : 'wrong'}.` });
      continue;
    }
    if (!(id in it.c)) { bad = `missing verdict for ${id}`; break; }
    if (!it.why[id]) { bad = `missing reason for ${id}`; break; }
    const q = it.c[id];
    if (q !== null && typeof q !== 'string') { bad = `${id} must be a quote or null`; break; }
    if (q !== null && !inText(q, text)) { bad = `${id} quote not in the answer: "${q}"`; break; }
    const present = id === 'C4' ? q === null : q !== null;
    concepts.push({ id, label, present, evidence: q ?? undefined, source: 'response', why: it.why[id] });
  }
  if (bad) { fail(bad); continue; }
  const extra = Object.keys(it.c).filter(k => !CONCEPTS[criterion].some(([id]) => id === k));
  if (extra.length) { fail(`concepts not in this criterion: ${extra.join(', ')}`); continue; }

  const level = levelFor(criterion, concepts, text);
  if (it.level !== undefined && it.level !== level) { fail(`stated level ${it.level} disagrees with levelFor (${level})`); continue; }
  const injection = INJECTION.test(text);
  const reviewFlag = level === null || injection || !!it.flag;
  const firstMissing = concepts.find(c => !c.present);

  const mark = {
    criterion, rubricVersion: RUBRIC_VERSION,
    concepts: concepts.map(c => ({ id: c.id, present: c.present, evidence: c.evidence ?? null, source: c.source })),
    level, insufficientEvidence: level === null, feedback: it.fb, nextStep: it.ns, reviewFlag,
  };
  const trace = [
    `${CRITERION_NAME[criterion]}, rubric ${RUBRIC_VERSION}.`,
    ...(injection ? ['The answer contains an instruction to the marker. It earns nothing and is flagged for review; the rest is marked normally.'] : []),
    ...concepts.map(c => {
      const verdict = c.present ? 'PRESENT' : 'ABSENT';
      const quoteLine = c.evidence ? ` Quote: "${c.evidence}".` : '';
      return `${c.id} (${c.label}): ${verdict}.${quoteLine} ${c.why}`;
    }),
    `Rule: ${RULE[criterion]} ${level === null ? 'Fewer than four words, so there is not enough evidence: level null, not 0.' : `Present: ${concepts.filter(c => c.present).map(c => c.id).join(', ') || 'none'} → level ${level}.`}`,
    firstMissing ? `Feedback targets ${firstMissing.id}, the first concept not yet shown.` : 'Every concept is shown, so the feedback confirms what worked and the next step stretches further.',
    ...(it.flag ? [`Review flag: ${it.flag}`] : []),
  ].join('\n');
  const anchors = criterion === 'judgement' ? ctx.facts.anchors : undefined;
  const row = {
    id: key, split: ctx.holdOut ? 'test' : 'train', kind: it.tag?.startsWith('robust') ? 'robustness' : 'marking',
    criterion, author: it.author ?? 'claude', tag: it.tag ?? '', level,
    prompt: markingPrompt(criterion, ctx.packet, text, anchors),
    completion: JSON.stringify(mark),
    reasoning_trace: trace,
  };
  rows.push(row);
  marked.set(key, { mark, text, ctx });
}

for (const f of readDir('followups')) {
  const where = `${f._file}:${f._line}`;
  const base = marked.get(f.item);
  const fail = (reason: string) => rejects.push({ where: `${where} (${f.item})`, reason });
  if (!base) { fail('follow-up refers to an unknown or rejected item'); continue; }
  if (!f.q || !f.a || !Array.isArray(f.uses)) { fail('missing q/a/uses'); continue; }
  const lvl = base.mark.level as number | null;
  // Only statements about the pupil's own level count ("Level 1 of 2", "you have level 1"); "for level 2 you need…" is a goal.
  const claimed = [...f.a.matchAll(/(?:level (\d) of 2|(?:you have|you got|you get|gives you|gives|stays(?: at)?|this is|that's|which is|it is|it's) level (\d))/gi)].map(m => Number(m[1] ?? m[2]));
  if (claimed.some(l => l !== lvl)) { fail(`answer claims a different level (${claimed.join(',')} vs ${lvl})`); continue; }
  const ids = (base.mark.concepts as { id: string }[]).map(c => c.id);
  if (f.uses.some((u: string) => !ids.includes(u))) { fail('uses a concept that is not in the mark'); continue; }
  rows.push({
    id: `${f.item}?${f._line}`, split: base.ctx.holdOut ? 'test' : 'train', kind: 'followup', criterion: base.mark.criterion, author: 'claude', tag: 'followup', level: lvl,
    prompt: [`A pupil aged 11–14 asks about the feedback on their answer. Answer in two to four plain sentences, using only the evidence and concepts in the mark. Do not change the mark unless the pupil gives new evidence; explain how to show it next time instead.`,
      '', `EVIDENCE:`, JSON.stringify(base.ctx.packet, null, 1), '', `PUPIL'S ANSWER:`, `"""${base.text}"""`, '', `MARK:`, JSON.stringify(base.mark), '', `PUPIL'S QUESTION:`, f.q].join('\n'),
    completion: f.a,
    reasoning_trace: `The question is about the mark for ${CRITERION_NAME[base.mark.criterion as Criterion]} (level ${lvl ?? 'null'}). The answer relies on ${f.uses.join(', ') || 'the overall rule'}: ${f.uses.map((u: string) => { const c = (base.mark.concepts as { id: string; present: boolean; evidence: string | null }[]).find(x => x.id === u)!; return `${u} is ${c.present ? 'present' : 'absent'}${c.evidence ? ` ("${c.evidence}")` : ''}`; }).join('; ')}. The mark stays the same because no new evidence was given.`,
  });
}

mkdirSync(DIR + 'rows', { recursive: true });
for (const split of ['train', 'test']) writeFileSync(DIR + `rows/${split}.jsonl`, rows.filter(r => r.split === split).map(r => JSON.stringify(r)).join('\n') + '\n');
const by = (k: string) => rows.reduce<Record<string, number>>((a, r) => ((a[String(r[k])] = (a[String(r[k])] ?? 0) + 1), a), {});
const reasons = rejects.reduce<Record<string, number>>((a, r) => { const k = r.reason.replace(/".*"/, '"…"'); a[k] = (a[k] ?? 0) + 1; return a; }, {});
const report = { accepted: rows.length, rejected: rejects.length, acceptanceRate: +(rows.length / Math.max(1, rows.length + rejects.length)).toFixed(3),
  bySplit: by('split'), byKind: by('kind'), byCriterion: by('criterion'), byLevel: by('level'), byAuthor: by('author'), rejectReasons: reasons, rejects };
writeFileSync(DIR + 'rows/report.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, rejects: rejects.slice(0, 15) }, null, 1));
