/**
 * Mixed-family check (handoff §6.3): a non-Anthropic model hosted on Adaption marks every row
 * blind, from the same prompt, and we compare its concepts and level with Claude's.
 *
 *   npx vite-node scripts/marking-data/judge.ts prep            → data/judge/input.jsonl
 *   (run the input through adaption_batch_responses → data/judge/<model>.jsonl)
 *   npx vite-node scripts/marking-data/judge.ts compare <model> → data/judge/report-<model>.json
 *
 * Agreement is a consistency check, not proof of validity. Rows where the levels disagree go to
 * the hard-case pool (data/judge/hard-cases.jsonl) and are left out of training.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { levelFor, type Criterion } from '../../src/engine/marking';

const DIR = new URL('./data/', import.meta.url).pathname;
const read = (f: string) => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : [];
const rows = [...read(DIR + 'rows/train.jsonl'), ...read(DIR + 'rows/test.jsonl')].filter(r => r.kind !== 'followup');
mkdirSync(DIR + 'judge', { recursive: true });

const [mode, model = 'qwen3.5-397b'] = process.argv.slice(2);

if (mode === 'prep') {
  writeFileSync(DIR + 'judge/input.jsonl', rows.map(r => JSON.stringify({ id: r.id, input: r.prompt })).join('\n') + '\n');
  console.log(`${rows.length} rows written to judge/input.jsonl`);
} else if (mode === 'compare') {
  const out = new Map(read(DIR + `judge/${model}.jsonl`).map(o => [o.id, o]));
  const textOf = (prompt: string) => prompt.slice(prompt.lastIndexOf('"""', prompt.length - 4) + 3, -3);
  let n = 0, parsed = 0, levelAgree = 0, conceptAgree = 0, conceptTotal = 0;
  const perConcept: Record<string, { agree: number; total: number }> = {};
  const hard: unknown[] = [];
  const confusion: Record<string, number> = {};
  for (const r of rows) {
    const o = out.get(r.id);
    if (!o) continue;
    n++;
    let j: { concepts?: { id: string; present: boolean }[] } | null = null;
    try { j = JSON.parse(String(o.output_text).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')); } catch { j = null; }
    if (!j?.concepts) { hard.push({ id: r.id, reason: 'judge output not parseable' }); continue; }
    parsed++;
    const mine = JSON.parse(r.completion);
    // Recompute the judge's level from its concepts with the same rule (and our computed A1).
    const theirs = mine.concepts.map((c: { id: string; present: boolean }) => c.id === 'A1' ? c : { ...c, present: !!j!.concepts!.find(x => x.id === c.id)?.present });
    const theirLevel = levelFor(r.criterion as Criterion, theirs, textOf(r.prompt));
    confusion[`${mine.level}->${theirLevel}`] = (confusion[`${mine.level}->${theirLevel}`] ?? 0) + 1;
    if (theirLevel === mine.level) levelAgree++;
    else hard.push({ id: r.id, criterion: r.criterion, claude: mine.level, judge: theirLevel,
      differ: mine.concepts.filter((c: { id: string; present: boolean }, i: number) => c.present !== theirs[i].present).map((c: { id: string; present: boolean }) => `${c.id}:${c.present ? 'claude-yes' : 'claude-no'}`) });
    for (const [i, c] of mine.concepts.entries()) {
      if (c.id === 'A1') continue;
      const k = c.id;
      perConcept[k] ??= { agree: 0, total: 0 };
      perConcept[k].total++; conceptTotal++;
      if (c.present === theirs[i].present) { perConcept[k].agree++; conceptAgree++; }
    }
  }
  const report = { model, rows: n, parsed, levelAgreement: +(levelAgree / Math.max(1, parsed)).toFixed(3), conceptAgreement: +(conceptAgree / Math.max(1, conceptTotal)).toFixed(3),
    perConcept: Object.fromEntries(Object.entries(perConcept).map(([k, v]) => [k, +(v.agree / v.total).toFixed(2)])), confusion, hardCases: hard.length };
  writeFileSync(DIR + `judge/report-${model}.json`, JSON.stringify(report, null, 1));
  writeFileSync(DIR + 'judge/hard-cases.jsonl', hard.map(h => JSON.stringify(h)).join('\n') + '\n');
  console.log(JSON.stringify(report, null, 1));
}
