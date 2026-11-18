import { MissionResultLink } from '../components/MissionReport';
import { useMission } from '../store/mission';
import { Link } from 'react-router-dom';
import { DIM_ICON } from '../components/icons';
import CompetencyRadar from '../components/Radar';
import Timeline from '../components/Timeline';
import { COMPETENCY_META } from '../data/blocks';
import { CHALLENGES } from '../data/challenges';
import { breakSummary } from '../engine/breaker';
import { averageScores, DIMS, feedbackFor, profileChallenge, type Dim } from '../engine/profile';
import { useSession } from '../store/session';

const NEXT_QUESTION: Record<Dim, string> = {
  verification: 'What if the AI just makes this up?',
  privacy: "Is anyone's personal info about to be sent?",
  integrity: 'Is the AI doing the thinking they should be doing?',
  bias: 'Who would disagree with this answer?',
  usefulness: 'Am I blocking questions that are actually fine?',
};

export default function Profile() {
  const missionPhase = useMission(s => s.mission.phase);
  const progress = useSession((s) => s.progress);
  const breakProgress = useSession((s) => s.breakProgress);
  const breaks = CHALLENGES.map((c) => ({ c, s: breakSummary(c, breakProgress[c.id] ?? []) })).filter((x) => x.s);
  const profiles = CHALLENGES.filter((c) => progress[c.id]?.attempts.length).map((c) => ({ c, p: profileChallenge(c.id, progress[c.id]) }));

  if (!profiles.length && !breaks.length) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4">
        <h1 className="text-4xl font-extrabold">{missionPhase === 'brief' ? 'No results yet' : 'My results'}</h1>
        <MissionResultLink />
        <p className="text-ink-2 mt-3 text-lg">Practice results appear here after you run a helper against the hidden tests.</p>
        <Link to="/" className="btn bg-signal mt-6">Choose a challenge</Link>
      </div>
    );
  }

  const first = averageScores(profiles.map(({ p }) => p.anticipated));
  const now = averageScores(profiles.map(({ p }) => p.current));
  const reflAll = profiles.flatMap(({ c }) => progress[c.id].reflections);
  const reflAcc = reflAll.length ? Math.round((reflAll.filter((r) => r.correct).length / reflAll.length) * 100) : null;
  const attempts = profiles.reduce((a, { p }) => a + p.attempts, 0);
  const misconceptions = [...new Set(profiles.flatMap(({ p }) => p.misconceptions))];
  const weakest = DIMS.filter((d) => now[d] !== null).sort((a, b) => (now[a] ?? 0) - (now[b] ?? 0))[0];

  return (
    <div className="max-w-[1200px] mx-auto px-4 py-10" data-testid="profile">
      <h1 className="text-5xl font-extrabold">My results</h1>
      <MissionResultLink />
      <p className="text-ink-2 mt-2 text-lg max-w-3xl">
        From {attempts} run{attempts === 1 ? '' : 's'} across {profiles.length} challenge{profiles.length === 1 ? '' : 's'}. The dashed line is your first run,
        before you had seen any tests. The yellow shape is your latest run.
      </p>

      <div className="grid lg:grid-cols-[1fr_1.15fr] gap-6 mt-8">
        <div className="rounded-md border-1.5 border-ink bg-paper-card p-4">
          <CompetencyRadar first={first} now={now} height={360} />
        </div>
        <div className="rounded-md border-1.5 border-ink bg-paper-card divide-y-1.5 divide-line">
          {DIMS.map((d) => {
            const m = COMPETENCY_META[d];
            const Icon = DIM_ICON[d];
            const v = now[d];
            return (
              <div key={d} className="p-4">
                <div className="flex items-center gap-3">
                  <Icon size={20} aria-hidden style={{ color: m.color }} />
                  <span className="font-display font-bold text-lg flex-1">{m.label}</span>
                  <span className="font-mono font-bold text-xl">{v ?? '–'}</span>
                </div>
                <div className="h-2 rounded-sm bg-paper-deep mt-2 overflow-hidden" aria-hidden>
                  <div className="h-full" style={{ width: `${v ?? 0}%`, background: m.color }} />
                </div>
                <p className="text-ink-2 mt-2 leading-snug">{feedbackFor(d, v, first[d])}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="rounded-md border-1.5 border-ink bg-ink text-paper p-5">
          <div className="label text-paper/70">Explaining failures</div>
          <div className="font-mono text-4xl font-bold mt-2">{reflAcc ?? '–'}{reflAcc !== null && '%'}</div>
          <p className="text-paper/85 mt-1">of your explanations for why a test failed were right.</p>
        </div>
        <div className="rounded-md border-1.5 border-ink bg-paper-card p-5">
          <div className="label text-ink-2">Mistakes to watch for</div>
          {misconceptions.length ? (
            <ul className="mt-2 space-y-1.5 list-disc pl-5">{misconceptions.map((m) => <li key={m}>{m}</li>)}</ul>
          ) : (
            <p className="mt-2 text-ink-2">Nothing that came up more than once.</p>
          )}
        </div>
        <div className="rounded-md border-1.5 border-ink bg-signal p-5">
          <div className="label">Before your next run</div>
          {weakest && (
            <p className="mt-2 text-lg font-bold leading-snug">
              Your lowest score is {COMPETENCY_META[weakest].label.toLowerCase()}. Ask yourself: "{NEXT_QUESTION[weakest]}"
            </p>
          )}
          <Link to="/" className="inline-block mt-3 font-bold underline underline-offset-2">Try another challenge</Link>
        </div>
      </div>

      <h2 className="text-3xl font-extrabold mt-12 mb-4">Spotting weak spots</h2>
      {breaks.length ? (
        <div className="grid md:grid-cols-3 gap-4">
          {breaks.map(({ c, s }) => (
            <div key={c.id} className="rounded-md border-1.5 border-ink bg-paper-card p-5">
              <h3 className="font-extrabold">{c.title}</h3>
              <div className="font-mono text-3xl font-bold mt-2">{s!.found}/{s!.total}</div>
              <p className="text-ink-2 text-sm mt-1">weak spots found in {s!.attempts} attempt{s!.attempts === 1 ? '' : 's'}. {s!.precision}% of your attacks broke the helper.</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ink-2">You haven't tried Break mode yet. On any challenge, choose "Break one" to find the weak spots in someone else's helper.</p>
      )}

      <h2 className="text-3xl font-extrabold mt-12 mb-4">Run by run</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {profiles.map(({ c, p }) => (
          <div key={c.id} className="rounded-md border-1.5 border-ink bg-paper-card p-5">
            <h3 className="text-xl font-extrabold">{c.title}</h3>
            <Timeline profile={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
