/**
 * Stages 2–3 of the scaled pipeline: batch marking by two hosted models, then the gate.
 *
 *   npx vite-node scripts/marking-data/scale/mark.ts calib-prep <models,...>  → data/scale/calib/input.jsonl
 *   npx vite-node scripts/marking-data/scale/mark.ts calib-report             → agreement of each model with Claude's marks
 *   npx vite-node scripts/marking-data/scale/mark.ts prep <modelA,modelB>     → data/scale/mark/input.jsonl
 *   npx vite-node scripts/marking-data/scale/mark.ts collect <modelA,modelB>  → data/items/x01-scale.jsonl + data/scale/report.json
 *
 * The account allows 25 requests a minute, so one call marks up to PER_CALL answers to the same
 * task. Each answer is marked on its own: the prompt says so, and every answer is numbered.
 *
 * The gate (collect): an answer becomes a training item only if
 *   - both markers' JSON parses and covers every concept,
 *   - every "present" quote from marker A is really in the pupil's answer (else marker B's quote is used),
 *   - both markers give the same level under levelFor (A1 always comes from the simulator),
 *   - and the answer is at least 4 words and not an obvious copy of the instructions.
 * Marker A's quotes, reasons and feedback become the item. build.ts then validates it like any other.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { levelFor, type Criterion } from '../../../src/engine/marking';
import { CONCEPTS, markingPrompt, inText } from '../prompt';

const DIR = new URL('../data/', import.meta.url).pathname;
const read = (f: string) => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : [];
const contexts = new Map(read(DIR + 'contexts.jsonl').map(c => [c.id, c]));
const PER_CALL = 8;

/** A prompt that marks several answers to the same task, each on its own. */
function batchPrompt(ctxId: string, texts: string[]) {
  const ctx = contexts.get(ctxId)!;
  const criterion = ctx.criterion as Criterion;
  const anchors = criterion === 'judgement' ? ctx.facts.anchors : undefined;
  const base = markingPrompt(criterion, ctx.packet, '\u0000', anchors);
  const ids = CONCEPTS[criterion].map(([id]) => id).filter(id => id !== 'A1');
  const head = base.slice(0, base.indexOf(`PUPIL'S ANSWER:`))
    .replace(/^You mark one written answer/, `You mark ${texts.length} written answers, each from a different pupil,`)
    .replace(/Reply with JSON only: .*$/m,
      `Mark each answer on its own, as if it were the only one: never let one answer affect another. ` +
      `Reply with a JSON array only, one object per answer in the same order: ` +
      `[{"n":1,"concepts":[{"id","present","evidence","why"}],"feedback","nextStep","reviewFlag"}]. ` +
      `Give concepts ${ids.join(', ')} for every answer` + (criterion === 'anticipation' ? ' (A1 is computed from the simulator: leave it out)' : '') + `. ` +
      `"evidence" is the pupil's exact words (copied character for character) when present, else null; for C4, "present" means no out-of-date detail is repeated, and when it is false "evidence" quotes the out-of-date detail. ` +
      `"why" is one sentence. "feedback" names one specific point and "nextStep" one question or action, both in plain words for the pupil.`);
  return head + texts.map((t, i) => `PUPIL ANSWER ${i + 1}:\n"""${t}"""`).join('\n\n');
}

function parseArray(s: string): any[] | null {
  try { const j = JSON.parse(String(s).replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/, '$1')); return Array.isArray(j) ? j : null; } catch { return null; }
}

/** Every complete double-quoted JSON string in a text, in order (for damaged arrays). */
function stringsIn(s: string): string[] {
  const body = s.slice(Math.max(0, s.indexOf('[')));
  return [...body.matchAll(/"((?:[^"\\]|\\.)*)"/gs)].map(m => { try { return JSON.parse('"' + m[1].replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'); } catch { return ''; } }).filter(Boolean);
}

/** Level for one marker's verdicts, using our rule and the simulator's A1. */
function levelOf(ctxId: string, text: string, concepts: any[]) {
  const ctx = contexts.get(ctxId)!;
  const criterion = ctx.criterion as Criterion;
  const list = CONCEPTS[criterion].map(([id]) => id === 'A1'
    ? { id, present: !!ctx.facts.predictionCorrect }
    : { id, present: !!concepts.find((c: any) => c?.id === id)?.present });
  return levelFor(criterion, list as any, text);
}

const [mode, modelArg = ''] = process.argv.slice(2);
const models = modelArg.split(',').filter(Boolean);
mkdirSync(DIR + 'scale/mark', { recursive: true });

if (mode === 'calib-prep') {
  // Claude's own marks, grouped by context, as the reference for choosing markers.
  const hard = new Set(read(DIR + 'judge/hard-cases.jsonl').map(h => h.id));
  const rows = read(DIR + 'rows/train.jsonl').filter(r => r.kind === 'marking' && r.author === 'claude' && !hard.has(r.id));
  const byCtx = new Map<string, any[]>();
  for (const r of rows) { const c = r.id.split('#')[0]; byCtx.set(c, [...(byCtx.get(c) ?? []), r]); }
  const groups: any[][] = [];
  const perCrit: Record<string, number> = {};
  for (const [c, rs] of byCtx) {
    const crit = contexts.get(c)!.criterion;
    if (rs.length < 2 || (perCrit[crit] ?? 0) >= 6) continue;
    perCrit[crit] = (perCrit[crit] ?? 0) + 1;
    groups.push(rs.slice(0, PER_CALL));
  }
  const textOf = (p: string) => p.slice(p.lastIndexOf('"""', p.length - 4) + 3, -3);
  const out = models.flatMap(m => groups.map((g, gi) => ({ id: `${m}::${gi}`, model: m, input: batchPrompt(g[0].id.split('#')[0], g.map(r => textOf(r.prompt))), rows: g.map(r => r.id) })));
  mkdirSync(DIR + 'scale/calib', { recursive: true });
  writeFileSync(DIR + 'scale/calib/input.jsonl', out.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.log(`${groups.length} groups (${groups.reduce((a, g) => a + g.length, 0)} answers) × ${models.length} models = ${out.length} calls`, perCrit);
} else if (mode === 'calib-report') {
  const rows = new Map(read(DIR + 'rows/train.jsonl').map(r => [r.id, r]));
  const inputs = new Map(read(DIR + 'scale/calib/input.jsonl').map(o => [o.id, o]));
  const stats: Record<string, { calls: number; parsed: number; n: number; level: number; concept: number; conceptN: number; byCrit: Record<string, [number, number]> }> = {};
  const textOf = (p: string) => p.slice(p.lastIndexOf('"""', p.length - 4) + 3, -3);
  for (const o of read(DIR + 'scale/calib/output.jsonl')) {
    const inp = inputs.get(o.id); if (!inp) continue;
    const s = stats[inp.model] ??= { calls: 0, parsed: 0, n: 0, level: 0, concept: 0, conceptN: 0, byCrit: {} };
    s.calls++;
    const arr = o.error ? null : parseArray(o.output_text);
    if (!arr || arr.length !== inp.rows.length) continue;
    s.parsed++;
    inp.rows.forEach((rid: string, i: number) => {
      const r = rows.get(rid)!; const mine = JSON.parse(r.completion); const text = textOf(r.prompt);
      const theirs = arr[i]?.concepts ?? [];
      const lv = levelOf(rid.split('#')[0], text, theirs);
      s.n++; if (lv === mine.level) s.level++;
      const b = s.byCrit[r.criterion] ??= [0, 0]; b[1]++; if (lv === mine.level) b[0]++;
      for (const c of mine.concepts) if (c.id !== 'A1') { s.conceptN++; if (!!theirs.find((x: any) => x?.id === c.id)?.present === c.present) s.concept++; }
    });
  }
  const report = Object.fromEntries(Object.entries(stats).map(([m, s]) => [m, { calls: `${s.parsed}/${s.calls} parsed`, answers: s.n,
    level: +(s.level / Math.max(1, s.n)).toFixed(3), concept: +(s.concept / Math.max(1, s.conceptN)).toFixed(3),
    byCriterion: Object.fromEntries(Object.entries(s.byCrit).map(([k, [a, t]]) => [k, `${a}/${t}`])) }]));
  writeFileSync(DIR + 'scale/calib/report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
} else if (mode === 'prep') {
  // Generated answers → batches of PER_CALL answers per context, one call per marker.
  const gen = new Map(read(DIR + 'scale/gen/input.jsonl').map(g => [g.id, g]));
  const answers: { id: string; ctx: string; text: string; author: string; content: number }[] = [];
  for (const o of read(DIR + 'scale/gen-out/answers.jsonl')) {
    const g = gen.get(o.id); if (!g || o.error) continue;
    // Lenient: a list cut off before "]", or with raw line breaks inside strings, still yields
    // every complete string in order (the order matches the specs).
    const arr = parseArray(o.output_text) ?? stringsIn(String(o.output_text ?? ''));
    if (!arr.length || arr.length > g.specs.length) continue;
    arr.forEach((t: unknown, i: number) => {
      const text = String(t ?? '').trim().replace(/^["“](.*)["”]$/s, '$1');
      if (text.split(/\s+/).length >= 4 && !/content:|style:|instructions/i.test(text))
        answers.push({ id: `${g.ctx}|s${g.specs[i].i}`, ctx: g.ctx, text, author: g.model, content: g.specs[i].content });
    });
  }
  writeFileSync(DIR + 'scale/answers.jsonl', answers.map(a => JSON.stringify(a)).join('\n') + '\n');
  const byCtx = new Map<string, typeof answers>();
  for (const a of answers) byCtx.set(a.ctx, [...(byCtx.get(a.ctx) ?? []), a]);
  const calls: unknown[] = [];
  for (const [c, as] of byCtx) for (let b = 0; b < as.length; b += PER_CALL) {
    const chunk = as.slice(b, b + PER_CALL);
    const input = batchPrompt(c, chunk.map(a => a.text));
    for (const m of models) calls.push({ id: `${m}::${c}::${b / PER_CALL}`, model: m, input, answers: chunk.map(a => a.id) });
  }
  writeFileSync(DIR + 'scale/mark/input.jsonl', calls.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.log(`${answers.length} usable answers from ${gen.size} generation calls → ${calls.length} marking calls`);
} else if (mode === 'collect') {
  const [A, B] = models;
  const answers = new Map(read(DIR + 'scale/answers.jsonl').map(a => [a.id, a]));
  const inputs = new Map(read(DIR + 'scale/mark/input.jsonl').map(o => [o.id, o]));
  const marks: Record<string, Map<string, any>> = { [A]: new Map(), [B]: new Map() };
  for (const o of read(DIR + 'scale/mark/output.jsonl')) {
    const inp = inputs.get(o.id); if (!inp || o.error) continue;
    const arr = parseArray(o.output_text);
    if (!arr || arr.length !== inp.answers.length) continue;
    inp.answers.forEach((aid: string, i: number) => marks[inp.model]?.set(aid, arr[i]));
  }
  const reasons: Record<string, number> = {};
  const drop = (r: string) => { reasons[r] = (reasons[r] ?? 0) + 1; };
  const items: unknown[] = [];
  const kept: Record<string, number> = {};
  for (const [aid, a] of answers) {
    const ma = marks[A].get(aid), mb = marks[B].get(aid);
    if (!ma || !mb) { drop('not marked by both'); continue; }
    const ctx = contexts.get(a.ctx)!; const criterion = ctx.criterion as Criterion;
    const ids = CONCEPTS[criterion].map(([id]) => id).filter(id => id !== 'A1');
    const get = (m: any, id: string) => (m?.concepts ?? []).find((c: any) => c?.id === id);
    if (ids.some(id => !get(ma, id) || !get(mb, id))) { drop('a concept is missing'); continue; }
    const la = levelOf(a.ctx, a.text, ma.concepts), lb = levelOf(a.ctx, a.text, mb.concepts);
    if (la !== lb) { drop('markers disagree on level'); continue; }
    const c: Record<string, string | null> = {}, why: Record<string, string> = {};
    let bad = '';
    for (const id of ids) {
      const x = get(ma, id), y = get(mb, id);
      const needsQuote = id === 'C4' ? !x.present : !!x.present;
      if (!needsQuote) { c[id] = null; why[id] = String(x.why || (id === 'C4' ? 'No out-of-date detail is repeated.' : 'Not shown in the answer.')); continue; }
      const q = [x.evidence, y?.evidence].find(e => typeof e === 'string' && e.trim() && inText(e, a.text));
      if (!q) { bad = `${id} quote not in the answer`; break; }
      c[id] = q; why[id] = String(x.why || 'Shown in the quoted words.');
    }
    if (bad) { drop(bad); continue; }
    if (!ma.feedback || !ma.nextStep) { drop('no feedback'); continue; }
    items.push({ ctx: a.ctx, tag: `scale:c${a.content}`, author: a.author, text: a.text, c, why, fb: String(ma.feedback), ns: String(ma.nextStep),
      ...(ma.reviewFlag && mb.reviewFlag ? { flag: 'Both markers flagged this answer for review.' } : {}) });
    kept[criterion] = (kept[criterion] ?? 0) + 1;
  }
  writeFileSync(DIR + 'items/x01-scale.jsonl', items.map(i => JSON.stringify(i)).join('\n') + '\n');
  const report = { markers: [A, B], answers: answers.size, accepted: items.length, acceptance: +(items.length / Math.max(1, answers.size)).toFixed(3), keptByCriterion: kept, dropped: reasons };
  writeFileSync(DIR + 'scale/report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
