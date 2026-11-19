/**
 * Agreement of one model's marks with reference marks (no files changed except the report).
 *
 *   npx vite-node scripts/marking-data/scale/agree.ts <outputs.jsonl> [rows.jsonl ...]
 *
 * <outputs.jsonl>: adaption_batch_responses output ({id, output_text}). Rows default to
 * data/rows/train.jsonl and test.jsonl. The level is recomputed with levelFor from the model's
 * concepts (A1 always from the simulator), exactly as judge.ts does.
 */
import { readFileSync, existsSync } from 'node:fs';
import { levelFor, type Criterion } from '../../../src/engine/marking';

const read = (f: string) => existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : [];
const DIR = new URL('../data/', import.meta.url).pathname;
const [outFile, ...rowFiles] = process.argv.slice(2);
const rows = (rowFiles.length ? rowFiles : [DIR + 'rows/train.jsonl', DIR + 'rows/test.jsonl']).flatMap(read);
const byId = new Map(rows.map(r => [r.id, r]));
const textOf = (p: string) => p.slice(p.lastIndexOf('"""', p.length - 4) + 3, -3);

export function parseMark(s: string) {
  try { const j = JSON.parse(String(s).replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, '$1')); return j?.concepts ? j : null; } catch { return null; }
}

let n = 0, parsed = 0, lv = 0, ca = 0, ct = 0, errors = 0;
const per: Record<string, [number, number]> = {};
for (const o of read(outFile)) {
  const r = byId.get(o.id); if (!r) continue;
  n++;
  if (o.error) { errors++; continue; }
  const j = parseMark(o.output_text); if (!j) continue;
  parsed++;
  const mine = JSON.parse(r.completion);
  const theirs = mine.concepts.map((c: any) => c.id === 'A1' ? c : { ...c, present: !!j.concepts.find((x: any) => x.id === c.id)?.present });
  if (levelFor(r.criterion as Criterion, theirs, textOf(r.prompt)) === mine.level) lv++;
  per[r.criterion] ??= [0, 0]; per[r.criterion][1]++;
  if (levelFor(r.criterion as Criterion, theirs, textOf(r.prompt)) === mine.level) per[r.criterion][0]++;
  mine.concepts.forEach((c: any, i: number) => { if (c.id !== 'A1') { ct++; if (c.present === theirs[i].present) ca++; } });
}
console.log(JSON.stringify({ file: outFile.split('/').pop(), rows: n, errors, parsed, level: +(lv / Math.max(1, parsed)).toFixed(3), concept: +(ca / Math.max(1, ct)).toFixed(3),
  byCriterion: Object.fromEntries(Object.entries(per).map(([k, [a, t]]) => [k, `${a}/${t}`])) }));
