import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import CompetencyRadar from '../components/Radar';
import Timeline from '../components/Timeline';
import { COMPETENCY_META } from '../data/blocks';
import { CHALLENGES } from '../data/challenges';
import { SEED_STUDENTS, simulateBreak, simulateStudent } from '../data/seedClass';
import { breakSummary } from '../engine/breaker';
import { averageScores, DIMS, profileChallenge, type ChallengeProfile, type Dim } from '../engine/profile';
import { usePresenter } from '../store/presenter';
import { useSession } from '../store/session';

const heat = (v: number | null) =>
  v === null ? 'bg-paper text-ink-3' : v >= 80 ? 'bg-pass-soft text-pass' : v >= 45 ? 'bg-partial-soft text-partial' : 'bg-fail-soft text-fail';

interface Row {
  name: string;
  live?: boolean;
  profile: ChallengeProfile;
  spot: ReturnType<typeof breakSummary>;
}

export default function Teacher() {
  const [cid, setCid] = useState(CHALLENGES[0].id);
  const live = useSession((s) => s.progress[cid]);
  const liveBreak = useSession((s) => s.breakProgress[cid]);
  const [sel, setSel] = useState<string | null>(() => (usePresenter.getState().active ? 'You (live)' : null));

  const rows: Row[] = useMemo(() => {
    const ch = CHALLENGES.find((c) => c.id === cid)!;
    const seeded = SEED_STUDENTS.map((s, i) => ({
      name: s.name,
      profile: profileChallenge(cid, simulateStudent(s, cid, i)),
      spot: breakSummary(ch, simulateBreak(i, cid)),
    }));
    const hasLive = live?.attempts.length || liveBreak?.length;
    const me = hasLive
      ? [{ name: 'You (live)', live: true, profile: profileChallenge(cid, live ?? { script: [], attempts: [], reflections: [], events: [], pendingReflection: null, seen: [] }), spot: breakSummary(ch, liveBreak ?? []) }]
      : [];
    return [...me, ...seeded];
  }, [cid, live, liveBreak]);

  const selected = rows.find((r) => r.name === sel) ?? null;
  const n = rows.length;

  const firstAvg = averageScores(rows.map((r) => r.profile.anticipated));
  const nowAvg = averageScores(rows.map((r) => r.profile.current));
  const missedFirst = (d: Dim) => rows.filter((r) => (r.profile.anticipated?.[d] ?? 100) < 100).length;
  const miscCounts = new Map<string, number>();
  rows.forEach((r) => r.profile.misconceptions.forEach((m) => miscCounts.set(m, (miscCounts.get(m) ?? 0) + 1)));
  const topMisc = [...miscCounts.entries()].sort((a, b) => b[1] - a[1]);
  const refl = rows.map((r) => r.profile.reflectionAccuracy).filter((v): v is number => v !== null);
  const reflAvg = refl.length ? Math.round(refl.reduce((a, b) => a + b, 0) / refl.length) : null;
  const mostMissed = (['verification', 'privacy', 'integrity', 'bias'] as Dim[]).sort((a, b) => missedFirst(b) - missedFirst(a))[0];
  const cautious = rows.filter((r) => r.profile.misconceptions.some((m) => m.startsWith('Over-cautious'))).length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-10" data-testid="teacher">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-ink-2">8B Computing · Tuesday period 3</p>
          <h1 className="text-5xl font-extrabold mt-1">Class results</h1>
          <p className="text-ink-2 mt-2 max-w-2xl">Each score comes from running the student's own helper against the hidden tests. Select a student to see how they got there.</p>
        </div>
        <div role="tablist" aria-label="Challenge" className="flex flex-wrap gap-2 max-w-[760px] justify-end">
          {CHALLENGES.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={cid === c.id}
              onClick={() => { setCid(c.id); setSel(null); }}
              className={`px-3 py-2 text-sm font-bold border-1.5 border-ink rounded ${cid === c.id ? 'bg-ink text-paper' : 'bg-paper-card hover:bg-paper-deep'}`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid md:grid-cols-4 mt-8 border-1.5 border-ink rounded-md bg-paper-card divide-y-1.5 md:divide-y-0 md:divide-x-1.5 divide-ink">
        <Stat title="Most missed on the first run" value={COMPETENCY_META[mostMissed].label} sub={`${missedFirst(mostMissed)} of ${n} students did not plan for it`} />
        <Stat title="Most common mistake" value={topMisc[0] ? `${topMisc[0][1]} students` : 'None'} sub={topMisc[0]?.[0] ?? 'No repeated mistakes'} />
        <Stat title="Over-cautious" value={`${cautious} student${cautious === 1 ? '' : 's'}`} sub="Blocked normal questions at some point" />
        <Stat title="Explained failures correctly" value={reflAvg !== null ? `${reflAvg}%` : '–'} sub="Class average" />
      </dl>

      <div className="grid xl:grid-cols-[1fr_420px] gap-6 mt-6">
        <div className="rounded-md border-1.5 border-ink bg-paper-card overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Scores per student for {CHALLENGES.find((c) => c.id === cid)?.title}</caption>
            <thead>
              <tr className="text-left border-b-1.5 border-ink">
                <th scope="col" className="px-4 py-3 label">Student</th>
                {DIMS.map((d) => <th scope="col" key={d} className="px-2 py-3 text-center label">{COMPETENCY_META[d].short}</th>)}
                <th scope="col" className="px-2 py-3 text-center label" title="Break mode: weak spots found, and share of attacks that hit">Spot</th>
                <th scope="col" className="px-2 py-3 text-center label">Runs</th>
                <th scope="col" className="px-2 py-3 text-center label">Explained</th>
                <th scope="col" className="px-4 py-3 label">Mistakes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.name}
                  onClick={() => setSel(r.name)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(r.name))}
                  tabIndex={0}
                  aria-selected={sel === r.name}
                  className={`border-t border-line cursor-pointer ${sel === r.name ? 'bg-signal-soft' : 'hover:bg-paper'} ${r.live ? 'font-bold' : ''}`}
                  data-testid={r.live ? 'row-live' : undefined}
                >
                  <th scope="row" className="px-4 py-2 text-left whitespace-nowrap font-bold">
                    {r.name}
                    {r.live && <span className="ml-2 label text-pass">live</span>}
                  </th>
                  {DIMS.map((d) => {
                    const v = r.profile.current?.[d] ?? null;
                    const f = r.profile.anticipated?.[d] ?? null;
                    return (
                      <td key={d} className="px-1 py-1.5 text-center">
                        <div className={`rounded-sm py-1 font-mono font-bold ${heat(v)}`}>
                          {v ?? '–'}
                          {f !== null && v !== null && f !== v && <div className="text-[10px] font-sans font-bold opacity-80">was {f}</div>}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-1 py-1.5 text-center">
                    <div className={`rounded-sm py-1 font-mono font-bold ${heat(r.spot?.foundPct ?? null)}`}>
                      {r.spot ? `${r.spot.found}/${r.spot.total}` : '–'}
                      {r.spot && <div className="text-[10px] font-sans font-bold opacity-80">{r.spot.precision}% hit</div>}
                    </div>
                  </td>
                  <td className="px-2 text-center font-mono">{r.profile.attempts}</td>
                  <td className="px-2 text-center font-mono">{r.profile.reflectionAccuracy ?? '–'}{r.profile.reflectionAccuracy !== null && '%'}</td>
                  <td className="px-4 py-2 text-xs text-ink-2 max-w-[260px]">
                    {r.profile.misconceptions.slice(0, 2).map((m) => <div key={m} className="truncate" title={m}>{m}</div>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="rounded-md border-1.5 border-ink bg-paper-card p-5 self-start xl:sticky xl:top-4" aria-live="polite">
          {selected ? (
            <motion.div key={selected.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-extrabold">{selected.name}</h2>
              <CompetencyRadar
                first={selected.profile.anticipated ? averageScores([selected.profile.anticipated]) : null}
                now={averageScores([selected.profile.current])}
                height={250}
              />
              {selected.profile.misconceptions.length > 0 && (
                <div className="rounded bg-partial-soft p-3 mb-2">
                  <div className="font-bold">Worth talking through</div>
                  <ul className="list-disc pl-5 text-sm mt-1">{selected.profile.misconceptions.map((m) => <li key={m}>{m}</li>)}</ul>
                </div>
              )}
              <Timeline profile={selected.profile} />
            </motion.div>
          ) : (
            <div>
              <h2 className="text-xl font-extrabold">Whole class</h2>
              <CompetencyRadar first={firstAvg} now={nowAvg} height={280} firstLabel="First run" nowLabel="Latest run" />
              <p className="text-ink-2">The gap between the two shapes is what the class picked up by failing and fixing. Select a student to see their runs.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="p-5">
      <dt className="label text-ink-2">{title}</dt>
      <dd className="font-display text-2xl font-bold mt-2 leading-tight">{value}</dd>
      <dd className="text-sm text-ink-2 mt-1">{sub}</dd>
    </div>
  );
}
