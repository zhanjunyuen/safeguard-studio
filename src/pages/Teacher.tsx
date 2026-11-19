import { MissionResultLink } from '../components/MissionReport';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { ClassStudent } from '../lib/classData';
import { supabase } from '../lib/supabase';
import { fetchClass } from '../lib/sync';
import CompetencyRadar from '../components/Radar';
import Timeline from '../components/Timeline';
import { COMPETENCY_META } from '../data/blocks';
import { baseId, CHALLENGES, getChallenge, practiceLevels, practiceTitle } from '../data/challenges';
import { challengesIn, THEMES } from '../data/themes';
import { SEED_STUDENTS, simulateBreak, simulateStudent } from '../data/seedClass';
import { breakSummary, breakSummaryAll } from '../engine/breaker';
import { averageScores, DIMS, overallProfile, profileChallenge, type ChallengeProfile, type Dim } from '../engine/profile';
import type { BreakAttempt, ChallengeProgress } from '../store/session';
import { usePresenter } from '../store/presenter';
import { usePracticeStore } from '../store/session';

const heat = (v: number | null) =>
  v === null ? 'bg-paper text-ink-3' : v >= 80 ? 'bg-pass-soft text-pass' : v >= 45 ? 'bg-partial-soft text-partial' : 'bg-fail-soft text-fail';

interface Row {
  name: string;
  live?: boolean;
  profile: ChallengeProfile;
  spot: ReturnType<typeof breakSummary>;
  /** All-challenges view only: per-challenge breakdown for the drill-down */
  parts?: { profile: ChallengeProfile; spot: ReturnType<typeof breakSummary> }[];
}

interface StudentData {
  name: string;
  live?: boolean;
  progress: Record<string, ChallengeProgress | undefined>;
  breaks: Record<string, BreakAttempt[] | undefined>;
}

const ALL = 'all';
const EMPTY: ChallengeProgress = { script: [], attempts: [], reflections: [], events: [], pendingReflection: null, seen: [] };

export default function Teacher() {
  const useSession = usePracticeStore();
  const [cid, setCid] = useState<string>(ALL);
  const myProgress = useSession((s) => s.progress);
  const myBreaks = useSession((s) => s.breakProgress);
  const myClass = useSession((s) => s.classCode);
  const [source, setSource] = useState<'sample' | 'live'>('sample');
  const [code, setCode] = useState(myClass ?? 'DEMO8B');
  const [liveClass, setLiveClass] = useState<{ name: string; students: ClassStudent[] } | null>(null);
  const [liveErr, setLiveErr] = useState<string | null>(null);

  // Live class: poll every 5 seconds so new runs appear during the lesson.
  useEffect(() => {
    if (source !== 'live') return;
    let stop = false;
    const load = async () => {
      const c = await fetchClass(code);
      if (stop) return;
      if (c) { setLiveClass(c); setLiveErr(null); } else setLiveErr('No class found with that code.');
    };
    load();
    const t = window.setInterval(load, 5000);
    return () => { stop = true; window.clearInterval(t); };
  }, [source, code]);
  const [sel, setSel] = useState<string | null>(() => (usePresenter.getState().active ? 'You (live)' : null));

  // The sample class across every challenge, computed once (it never changes).
  const sampleClass: StudentData[] = useMemo(
    () =>
      SEED_STUDENTS.map((st, i) => ({
        name: st.name,
        progress: Object.fromEntries(CHALLENGES.map((c) => [c.id, simulateStudent(st, c.id, i)])),
        breaks: Object.fromEntries(CHALLENGES.map((c) => [c.id, simulateBreak(i, c.id)])),
      })),
    [],
  );

  const rows: Row[] = useMemo(() => {
    const me: StudentData = { name: 'You (live)', live: true, progress: myProgress, breaks: myBreaks };
    const students: StudentData[] = source === 'live' ? liveClass?.students ?? [] : [me, ...sampleClass];

    if (cid === ALL || cid.startsWith('theme:')) {
      const scope = cid === ALL ? CHALLENGES : challengesIn(cid.slice(6));
      const levels = practiceLevels(scope);
      const ids = new Set(levels.map((c) => c.id));
      return students
        .map((st) => {
          const profile = overallProfile(Object.fromEntries(Object.entries(st.progress).filter(([k]) => ids.has(k))));
          const spot = breakSummaryAll(scope.map((c) => ({ challenge: c, attempts: st.breaks[c.id] ?? [] })));
          const parts = levels.filter((c) => st.progress[c.id]?.attempts.length || st.breaks[c.id]?.length).map((c) => ({
            profile: profileChallenge(c.id, st.progress[c.id] ?? EMPTY),
            spot: breakSummary(c, st.breaks[c.id] ?? []),
          }));
          return { name: st.name, live: st.live, profile, spot, parts };
        })
        .filter((r) => r.parts.length);
    }

    const ch = getChallenge(cid)!;
    return students
      .filter((st) => st.progress[cid]?.attempts.length || st.breaks[cid]?.length)
      .map((st) => ({
        name: st.name,
        live: st.live,
        profile: profileChallenge(cid, st.progress[cid] ?? EMPTY),
        spot: breakSummary(ch, st.breaks[cid] ?? []),
      }));
  }, [cid, myProgress, myBreaks, source, liveClass, sampleClass]);

  const selected = rows.find((r) => r.name === sel) ?? null;
  const built = rows.filter((r) => r.profile.anticipated);
  const hasData = built.length > 0;
  const isAll = cid === ALL || cid.startsWith('theme:');
  const scopeSize = cid === ALL ? CHALLENGES.length : cid.startsWith('theme:') ? challengesIn(cid.slice(6)).length : 1;
  const challengeTitle = cid === ALL ? 'any challenge' : cid.startsWith('theme:') ? `the ${THEMES.find((t) => t.id === cid.slice(6))?.title} theme` : practiceTitle(cid);
  const notYet = 'Appears after the first run';

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
          <p className="label text-ink-2">{source === 'live' && liveClass ? `${liveClass.name} · live` : '8B Computing · sample class'}</p>
          <h1 className="text-5xl font-extrabold mt-1">Class results</h1>
          <p className="text-ink-2 mt-2 max-w-2xl">Each score comes from running the student's own helper against the hidden tests. Select a student to see how they got there.</p>
          {supabase && !usePresenter.getState().active && (
            <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="class-source">
              <div role="group" aria-label="Which class" className="flex border-1.5 border-ink rounded overflow-hidden text-sm font-bold">
                {(['sample', 'live'] as const).map((v) => (
                  <button key={v} aria-pressed={source === v} onClick={() => setSource(v)} className={`px-3 py-1.5 ${source === v ? 'bg-ink text-paper' : 'bg-paper-card'}`}>
                    {v === 'sample' ? 'Sample class' : 'Live class'}
                  </button>
                ))}
              </div>
              {source === 'live' && (
                <label className="text-sm font-bold flex items-center gap-2">
                  Class code
                  <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="w-28 rounded border-1.5 border-ink bg-paper-card px-2 py-1 font-mono" />
                </label>
              )}
              {source === 'live' && liveErr && <span className="text-fail text-sm font-bold">{liveErr}</span>}
            </div>
          )}
        </div>
        <label className="flex max-w-full flex-col gap-1 text-sm font-bold">
          Showing
          <select
            value={cid}
            onChange={(e) => setCid(e.target.value)}
            className="max-w-full sm:min-w-[300px] rounded border-1.5 border-ink bg-paper-card px-3 py-2.5 font-bold shadow-hard"
            data-testid="scope"
          >
            <option value={ALL}>All challenges</option>
            {THEMES.map((t) => (
              <optgroup key={t.id} label={t.title}>
                <option value={`theme:${t.id}`}>Whole theme: {t.title}</option>
                {practiceLevels(challengesIn(t.id)).map((c) => (
                  <option key={c.id} value={c.id}>{practiceTitle(c.id)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <MissionResultLink />
      <dl className="grid md:grid-cols-4 mt-8 border-1.5 border-ink rounded-md bg-paper-card divide-y-1.5 md:divide-y-0 md:divide-x-1.5 divide-ink">
        <Stat
          title="Most missed on the first run"
          value={hasData ? COMPETENCY_META[mostMissed].label : '–'}
          sub={hasData ? `${missedFirst(mostMissed)} of ${built.length} students did not plan for it` : notYet}
        />
        <Stat
          title="Most common mistake"
          value={!hasData ? '–' : topMisc[0] ? `${topMisc[0][1]} student${topMisc[0][1] === 1 ? '' : 's'}` : 'None'}
          sub={!hasData ? notYet : topMisc[0]?.[0] ?? 'No repeated mistakes'}
        />
        <Stat
          title="Over-cautious"
          value={hasData ? `${cautious} student${cautious === 1 ? '' : 's'}` : '–'}
          sub={hasData ? 'Blocked normal questions at some point' : notYet}
        />
        <Stat title="Explained failures correctly" value={reflAvg !== null ? `${reflAvg}%` : '–'} sub="Class average" />
      </dl>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-6 mt-6">
        <div className="rounded-md border-1.5 border-ink bg-paper-card overflow-x-auto">
          <table className="class-table w-full text-sm">
            <caption className="sr-only">Scores per student for {isAll ? 'all challenges combined' : challengeTitle}</caption>
            <thead>
              <tr className="text-left border-b-1.5 border-ink">
                <th scope="col" className="px-4 py-3 label">Student</th>
                {isAll && <th scope="col" className="px-2 py-3 text-center label" title="Challenges attempted">Tried</th>}
                {DIMS.map((d) => <th scope="col" key={d} className="px-2 py-3 text-center label">{COMPETENCY_META[d].short}</th>)}
                <th scope="col" className="px-2 py-3 text-center label" title="Break mode: weak spots found, and share of attacks that hit">Spot</th>
                <th scope="col" className="px-2 py-3 text-center label">Runs</th>
                <th scope="col" className="px-2 py-3 text-center label">Explained</th>
                <th scope="col" className="px-4 py-3 label">Mistakes</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={DIMS.length + (isAll ? 6 : 5)} className="px-6 py-16 text-center" data-testid="empty-class">
                    <p className="font-display text-xl font-bold">No runs yet{isAll ? '' : ` for ${challengeTitle}`}</p>
                    <p className="text-ink-2 mt-2 max-w-md mx-auto">
                      Students join on the home page with code <b className="font-mono text-ink">{code}</b>, then run {isAll ? 'any challenge' : 'this challenge'}. New runs appear here within a few seconds.
                    </p>
                  </td>
                </tr>
              )}
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
                  {isAll && <td className="px-2 text-center font-mono">{new Set(r.parts?.map(part => baseId(part.profile.challengeId))).size}/{scopeSize}</td>}
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
              {isAll ? (
                <table className="w-full text-sm mt-3" data-testid="per-challenge">
                  <caption className="text-left font-bold mb-1">By challenge</caption>
                  <thead>
                    <tr className="text-left border-b-1.5 border-ink">
                      <th scope="col" className="py-1.5 label">Challenge</th>
                      <th scope="col" className="py-1.5 label text-center">Runs</th>
                      <th scope="col" className="py-1.5 label text-center">Latest</th>
                      <th scope="col" className="py-1.5 label text-center">Spot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.parts ?? []).map(({ profile: p, spot }) => {
                      const last = p.timeline[p.timeline.length - 1];
                      return (
                        <tr key={p.challengeId} className="border-t border-line">
                          <th scope="row" className="py-1.5 text-left font-normal">
                            <button onClick={() => setCid(p.challengeId)} className="font-bold underline underline-offset-2 hover:no-underline text-left">
                              {practiceTitle(p.challengeId)}
                            </button>
                          </th>
                          <td className="text-center font-mono">{p.attempts || '–'}</td>
                          <td className="text-center font-mono">{last ? `${last.passed}/${last.total}` : '–'}</td>
                          <td className="text-center font-mono">{spot ? `${spot.found}/${spot.total}` : '–'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <Timeline profile={selected.profile} />
              )}
            </motion.div>
          ) : (
            <div>
              <h2 className="text-xl font-extrabold">Whole class{isAll ? ', all challenges' : ''}</h2>
              {hasData ? (
                <>
                  <CompetencyRadar first={firstAvg} now={nowAvg} height={280} firstLabel="First run" nowLabel="Latest run" />
                  <p className="text-ink-2">The gap between the two shapes is what the class picked up by failing and fixing. Select a student to see their runs.</p>
                </>
              ) : (
                <p className="text-ink-2 mt-2">The class chart appears once students have run {isAll ? 'a challenge' : 'this challenge'}.</p>
              )}
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
